# WS 프로토콜(모바일 계약):
#   Client → Server: Binary=raw PCM bytes(연속) / JSON {"type":"start","field_note_id","sample_rate"}·{"type":"pause"}·{"type":"resume"}·{"type":"finish"}
#   Server → Client: {"type":"session_started","session_id"} / {"type":"partial","text","stability","timestamp_seconds"}
#     / {"type":"final","text","start_seconds","end_seconds"} / {"type":"paused"}·{"type":"resumed"}
#     / {"type":"finished","audio_storage_path","total_duration"} / {"type":"error","code","message"}
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.exceptions import QuotaExceededException
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.core.logger import get_logger
from app.modules.field_note.field_note.repository import FieldNoteRepository
from app.modules.field_note.field_note_audio.models import FieldNoteAudioTranscriptStatus
from app.modules.field_note.field_note_audio.repository import FieldNoteAudioRepository
from app.modules.field_note.field_note_audio.services.create_audio_chunk import CreateAudioChunkService
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.llm.gateway.schemas import AICallContext
from app.modules.llm.credit_balance.plan_config import AIPurpose
from .session import (
    StreamingRecordingSession,
    get_active_session,
    register_session,
    unregister_session,
)

logger = get_logger(__name__)

router = APIRouter()


async def _save_audio_record(
    field_note_id: str,
    parts: list[dict],
    transcript: dict | None = None,
) -> None:
    # parts의 각 WAV part를 별도 청크 레코드로 등록 — 모든 part를 등록해야 긴 녹음(>10분) 오디오 무유실.
    # transcript(절대시간)는 청크0에 저장 — 청크0 오프셋=0이라 모바일 타임라인 정렬이 유지되고,
    # 파이프라인이 whisper 재전사를 생략하고 라이브 전사를 최종 본문으로 재사용한다.
    if not parts:
        return

    async with AsyncSessionLocal() as db_session:
        uow = UnitOfWork(db_session)
        async with uow:
            audio_repo = uow.repo(FieldNoteAudioRepository)
            service = CreateAudioChunkService(audio_repo)
            for i, part in enumerate(parts):
                # 모든 part 를 스트리밍 산출물로 마킹 — 라이브 전사가 전체를 커버하므로
                # 개별 청크 전사는 돌지 않는다. pending 으로 남기면 (1) 이어 녹음 화면에
                # '전사 중...' placeholder 가 영원히 뜨고 (2) 이어 녹음분 병합 시
                # 커버 여부 판정(execute_transcribe)이 흔들린다.
                await service.execute(
                    field_note_id=field_note_id,
                    storage_path=part["path"],
                    duration=part.get("duration", 0.0),
                    stt_model_used="aws-transcribe-streaming",
                    transcript_status=FieldNoteAudioTranscriptStatus.COMPLETED,
                    diarized_transcript=(
                        json.dumps(transcript, ensure_ascii=False)
                        if i == 0 and transcript and transcript.get("segments")
                        else None
                    ),
                )
            await uow.commit()


async def _authenticate_ws(websocket: WebSocket, token: str) -> dict | None:
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return None

    payload = get_token().decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return None

    return payload


async def _is_center_member(center_id: str, person_id: str) -> bool:
    # WebSocket은 Depends(current_center) 불가 — HTTP 라우트와 동일한 의존성 레이어
    # 리졸버로 멤버십을 확인(타 센터 스트림 차단). 비멤버면 403 → False.
    from fastapi import HTTPException

    from app.behavior.action.center import resolve_access

    async with AsyncSessionLocal() as session:
        try:
            await resolve_access(session, center_id, person_id)
            return True
        except HTTPException:
            return False


async def _is_note_in_center(field_note_id: str, center_id: str) -> bool:
    # field_note_id 가 이 센터 소유인지 확인(타 센터 노트에 오디오/전사 쓰기 + 과금 차단)
    async with AsyncSessionLocal() as session:
        note = await FieldNoteRepository(session).find_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )
        return note is not None


async def _response_pump(
    session: StreamingRecordingSession,
    websocket: WebSocket,
) -> None:
    try:
        async for response in session.get_responses():
            # 프로바이더 오류는 전사 라인이 아니라 error 제어 메시지로 전달
            # (예: 복구 불가 STT 오류). 절대 전사 결과처럼 렌더되지 않도록 한다.
            if getattr(response, "is_error", False):
                await websocket.send_json({
                    "type": "error",
                    "code": "stt_error",
                    "message": response.text,
                })
                continue
            if response.is_final:
                await websocket.send_json({
                    "type": "final",
                    "text": response.text,
                    "start_seconds": response.start_seconds,
                    "end_seconds": response.end_seconds,
                })
            else:
                await websocket.send_json({
                    "type": "partial",
                    "text": response.text,
                    "stability": response.stability,
                    "timestamp_seconds": response.end_seconds,
                })
    except WebSocketDisconnect:
        pass
    except RuntimeError as e:
        # 클라이언트가 끊긴 직후 send 시도 → ASGI RuntimeError("...after sending 'websocket.close'").
        # 앱 크래시·백그라운드 등 정상적 비정상종료라 ERROR 가 아니라 조용히 종료한다.
        msg = str(e).lower()
        if any(k in msg for k in ("websocket.close", "after sending", "disconnect", "completed")):
            logger.info("Response pump stopped: client disconnected")
        else:
            logger.error(f"Response pump error: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"Response pump error: {e}", exc_info=True)


@router.websocket("/centers/{center_id}/field-notes/stream")
async def stream_stt(
    websocket: WebSocket,
    center_id: str,
    token: str = Query(...),
):
    payload = await _authenticate_ws(websocket, token)
    if not payload:
        return

    account_id = payload.get("account_id", "")
    # WebSocket은 Depends 사용 불가 — member_id는 account_id로 대체
    # (실제로는 member 조회가 필요하지만 WebSocket에서는 간소화)
    member_id = payload.get("person_id", account_id)

    # 1-1. 센터 멤버십 검증 (타 센터 스트림 차단)
    if not await _is_center_member(center_id, member_id):
        await websocket.close(code=4003, reason="No access to this center")
        return

    # 2. 프로바이더 확인
    ai = create_ai_facade()
    if not ai.streaming_stt_available():
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "code": "mode_unavailable",
            "message": "Streaming STT is not enabled. Use whisper_chunk mode.",
        })
        await websocket.close(code=4002)
        return

    # 3. 유령 세션 정리 (last-write-wins)
    #    이전 연결이 finish 없이 비정상 종료(앱 백그라운드/리로드/네트워크 끊김)되면
    #    member_id 기준 세션이 메모리에 남는다. 새 연결을 session_exists로 거부하는 대신
    #    옛 세션을 정리(오디오 보존)하고 진행한다 — 상담사 1인 1녹음이므로 마지막 연결 우선.
    existing = get_active_session(member_id)
    if existing:
        logger.warning(
            f"Evicting stale streaming session: member={member_id}, "
            f"session={existing.session_id}"
        )
        try:
            if not existing._closed:
                stale_path = await existing.emergency_save()
                if stale_path:
                    await _save_audio_record(
                        field_note_id=existing.field_note_id,
                        parts=existing.get_parts(),
                        transcript=existing.build_transcript(),
                    )
        except Exception as e:
            logger.error(f"Failed to evict stale session: {e}", exc_info=True)
        finally:
            unregister_session(member_id, existing)

    await websocket.accept()
    session: StreamingRecordingSession | None = None
    pump_task: asyncio.Task | None = None

    try:
        while True:
            message = await websocket.receive()

            # 클라이언트 연결 종료 — 저수준 receive() 는 disconnect 시 예외가 아니라
            # {"type": "websocket.disconnect"} 메시지를 반환한다. 이를 끊지 않고 다시
            # receive() 하면 RuntimeError("Cannot call receive once disconnected") 발생.
            # 여기서 루프를 빠져나가면 finally 의 emergency_save 로 녹음이 보존된다.
            if message["type"] == "websocket.disconnect":
                logger.info(f"WebSocket client disconnected: member={member_id}")
                break

            # Binary frame: PCM 오디오 데이터
            if "bytes" in message and message["bytes"]:
                if session:
                    await session.feed_audio(message["bytes"])
                continue

            # Text frame: JSON 제어 메시지
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "code": "invalid_json",
                        "message": "Invalid JSON message",
                    })
                    continue

                msg_type = data.get("type", "")

                if msg_type == "start":
                    field_note_id = data.get("field_note_id", "")
                    sample_rate = data.get("sample_rate", 16000)

                    if not field_note_id:
                        await websocket.send_json({
                            "type": "error",
                            "code": "missing_field_note_id",
                            "message": "field_note_id is required",
                        })
                        continue

                    # 노트 소유 검증 (타 센터 노트에 쓰기/과금 차단)
                    if not await _is_note_in_center(field_note_id, center_id):
                        await websocket.send_json({
                            "type": "error",
                            "code": "note_not_found",
                            "message": "field_note를 찾을 수 없습니다",
                        })
                        continue

                    ctx = AICallContext(
                        center_id=center_id,
                        source_type="field_note",
                        source_id=field_note_id,
                        purpose=AIPurpose.FIELD_NOTE_STT_STREAMING,
                        pipeline_step="stt_streaming",
                        member_id=member_id,
                    )
                    try:
                        stt_session = await ai.transcribe_stream(
                            ctx, sample_rate=sample_rate,
                        )
                    except QuotaExceededException as e:
                        await websocket.send_json({
                            "type": "error",
                            "code": "quota_exceeded",
                            "message": str(e),
                        })
                        continue

                    session = StreamingRecordingSession(
                        field_note_id=field_note_id,
                        center_id=center_id,
                        member_id=member_id,
                        stt_session=stt_session,
                        sample_rate=sample_rate,
                    )
                    register_session(member_id, session)
                    await session.start()

                    # 응답 pump 시작
                    pump_task = asyncio.create_task(
                        _response_pump(session, websocket)
                    )

                    await websocket.send_json({
                        "type": "session_started",
                        "session_id": session.session_id,
                    })

                elif msg_type == "pause" and session:
                    await session.pause()
                    await websocket.send_json({"type": "paused"})

                elif msg_type == "resume" and session:
                    await session.resume()
                    await websocket.send_json({"type": "resumed"})

                elif msg_type == "finish" and session:
                    result = await session.finish()

                    # pump 태스크 정리
                    if pump_task:
                        pump_task.cancel()
                        try:
                            await pump_task
                        except asyncio.CancelledError:
                            pass

                    # 각 WAV part 를 청크 레코드로 + 라이브 전사 저장 (재사용 → whisper 재전사 생략)
                    if session.get_parts():
                        try:
                            await _save_audio_record(
                                field_note_id=session.field_note_id,
                                parts=session.get_parts(),
                                transcript=session.build_transcript(),
                            )
                        except Exception as e:
                            logger.error(f"Failed to save audio record: {e}", exc_info=True)

                    # AWS Transcribe 스트리밍 사용량 기록 (게이트웨이 세션 소유, 멱등)
                    await session.record_stt_usage()

                    await websocket.send_json({
                        "type": "finished",
                        "audio_storage_path": result["audio_storage_path"],
                        "total_duration": result["total_duration"],
                    })

                    unregister_session(member_id, session)
                    await websocket.close()
                    return

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: member={member_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "code": "internal_error",
                "message": str(e),
            })
        except Exception:
            pass
    finally:
        # 비정상 종료 시 emergency save
        if session and not session._closed:
            try:
                path = await session.emergency_save()
                if path:
                    logger.info(f"Emergency save: {path}")
                    # DB 레코드도 생성 — 나중에 파이프라인에서 처리할 수 있도록 (전사도 보존)
                    await _save_audio_record(
                        field_note_id=session.field_note_id,
                        parts=session.get_parts(),
                        transcript=session.build_transcript(),
                    )
                    # 비정상 종료도 사용량 기록 (멱등)
                    await session.record_stt_usage()
            except Exception as e:
                logger.error(f"Emergency save failed: {e}", exc_info=True)

        if pump_task and not pump_task.done():
            pump_task.cancel()

        unregister_session(member_id, session)
