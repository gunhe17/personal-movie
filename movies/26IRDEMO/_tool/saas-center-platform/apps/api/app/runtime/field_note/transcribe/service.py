from app.core.logger import get_logger
from app.infrastructure.stt.common.hallucination_filter import (
    filter_hallucinated_segments,
)
from app.modules.field_note.facade import FieldNoteDiarizationStatus, PipelineFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .silence_detection import detect_silence_markers

logger = get_logger(__name__)


class TranscribeAudioService:
    def __init__(
        self,
        facade: PipelineFacade,
        *,
        ai: AIFacade,
        storage,
    ):
        self._facade = facade
        self._ai = ai
        self._storage = storage

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        member_id: str | None = None,
    ) -> tuple[dict | None, list]:
        atomics = []
        # 기본(무료) 전사는 화자분리를 하지 않는다(유료 온디맨드 diarize). 결과는
        # 단일 화자("A")로 저장해 타임라인은 렌더하되 diarization_status="none"로 라벨은 숨긴다.

        # 평문 전사는 segment 타임스탬프(verbose_json)가 필요한데, 이는 whisper 계열만 지원한다
        # (gpt-4o-transcribe/mini 계열은 json/text만 → verbose_json 400). 기본 STT_MODEL 이나
        # stt_transcribe config 가 gpt-4o 계열이어도, 타임스탬프를 위해 whisper-1 을 강제한다.
        config = await self._ai.resolve_config("stt_transcribe")
        cfg_model = config.get("model_name")
        model_override = (
            cfg_model if (cfg_model and "whisper" in cfg_model.lower()) else "whisper-1"
        )

        audios = await self._facade.list_audios(field_note_id)
        if not audios:
            raise RuntimeError(f"No audio chunks found for field_note={field_note_id}")

        # 라이브 전사 재사용: 스트리밍(AWS)이 종료 시 전사를 이미 저장했으면 whisper 재전사를 생략하고
        # 사용자가 녹음 중 본 전사를 그대로 최종 본문으로 사용한다.
        streaming_audio = next(
            (
                a
                for a in audios
                if a.stt_model_used == "aws-transcribe-streaming"
                and a.diarized_transcript
            ),
            None,
        )
        if streaming_audio:
            result = await self._reuse_streaming_transcript(
                field_note_id,
                center_id,
                audios,
                model_override,
                member_id,
                atomics,
            )
            return result, atomics

        combined_audio = await self._facade.merge_audio_bytes(audios, self._storage)
        if not combined_audio:
            raise RuntimeError("No audio data collected")

        audio_bytes = bytes(combined_audio)

        ctx = self._ctx(field_note_id, center_id, member_id)
        stt_result = await self._ai.transcribe_with_timestamps(
            ctx,
            audio_bytes,
            model_override=model_override,
        )
        # 평문 세그먼트를 단일 화자("A")로 저장 — 타임라인 UX 유지, 화자 구분 없음
        plain_segments = [
            {
                "speaker": "A",
                "text": s.get("text", ""),
                "start": s.get("start", 0.0),
                "end": s.get("end", 0.0),
            }
            for s in stt_result.segments
        ]
        # 무음/짧은 구간에서 whisper 가 한국어 도메인 프롬프트를 환각으로 뱉는 경우 제거
        plain_segments, removed = filter_hallucinated_segments(plain_segments)
        if removed:
            logger.info(f"Plain transcribe: filtered {removed} hallucinated segment(s)")
        text = " ".join(
            s["text"].strip() for s in plain_segments if s.get("text", "").strip()
        )
        diarize_result = {"text": text, "segments": plain_segments}

        stt_model = model_override or "default"
        atomic, _ = await self._facade.mark_audio_diarized(
            audios[0].id,
            diarize_result=diarize_result,
            stt_model=stt_model,
        )
        atomics.append(atomic)

        # 기본 분석은 화자분리 미수행 → 상태 none (재시도 시에도 초기화)
        fn = await self._facade.find_note(field_note_id, center_id)
        if fn:
            atomic, _ = await self._facade.set_statuses(
                field_note_id,
                center_id,
                diarization_status=FieldNoteDiarizationStatus.NONE,
            )
            atomics.append(atomic)

        await self._save_silence_markers(
            field_note_id,
            center_id,
            audio_bytes,
            fn,
            atomics,
        )

        return diarize_result, atomics

    async def _reuse_streaming_transcript(
        self,
        field_note_id: str,
        center_id: str,
        audios: list,
        model_override: str,
        member_id: str | None,
        atomics: list,
    ) -> dict:
        if await self._facade.find_note(field_note_id, center_id):
            # 화자분리는 온디맨드(text-diarize)에서
            atomic, _ = await self._facade.set_statuses(
                field_note_id,
                center_id,
                diarization_status=FieldNoteDiarizationStatus.NONE,
            )
            atomics.append(atomic)

        # 규약: 청크별 diarized_transcript = 그 지점에서 시작한 세션의 "상대시간" 전사.
        # 전체 전사 = chunk_index 순 누적 duration 오프셋 합성(모바일 buildTimeline 과 동일).
        # 스트리밍 이어 녹음 세션의 전사는 그 세션 첫 청크에 실려 자동으로 합성된다.
        #
        # 커버 판정 — 라이브 전사가 이미 커버하는 청크:
        #  · diarized_transcript 보유(세션 첫 청크 / 이전 whisper 병합 결과)
        #  · 스트리밍 파트 마킹(aws-transcribe-streaming) 또는 이전 병합 마킹(whisper-1-merged)
        #  · 마킹 이전(레거시) 스트리밍 파트는 .wav 확장자로 식별(청크 업로드는 m4a/webm 계열)
        def _covered(a) -> bool:
            if a.diarized_transcript:
                return True
            if a.stt_model_used in ("aws-transcribe-streaming", "whisper-1-merged"):
                return True
            return bool(a.storage_path and a.storage_path.endswith(".wav"))

        extras = sorted(
            (a for a in audios if not _covered(a)),
            key=lambda a: a.chunk_index,
        )
        if extras:
            # chunk 모드 이어 녹음분 — whisper 로 전사해 첫 extra 청크에 "상대시간"으로
            # 저장(규약 동일). 나머지 extras 는 merged 마킹(멱등 — 재분석 시 중복 방지).
            logger.info(
                f"Transcribing {len(extras)} resumed chunk(s) for "
                f"field_note={field_note_id} (streaming transcript reuse + merge)"
            )
            extra_bytes = await self._facade.merge_audio_bytes(extras, self._storage)
            if extra_bytes:
                ctx = self._ctx(field_note_id, center_id, member_id)
                stt_result = await self._ai.transcribe_with_timestamps(
                    ctx,
                    bytes(extra_bytes),
                    model_override=model_override,
                )
                new_segments = [
                    {
                        "speaker": "A",
                        "text": s.get("text", ""),
                        "start": s.get("start", 0.0) or 0.0,
                        "end": s.get("end", 0.0) or 0.0,
                    }
                    for s in stt_result.segments
                ]
                new_segments, removed = filter_hallucinated_segments(new_segments)
                if removed:
                    logger.info(
                        f"Resumed-chunk transcribe: filtered {removed} hallucinated segment(s)"
                    )
                extra_text = " ".join(
                    s["text"].strip() for s in new_segments if s.get("text", "").strip()
                )
                atomic, _ = await self._facade.mark_audio_diarized(
                    extras[0].id,
                    diarize_result={"text": extra_text, "segments": new_segments},
                    stt_model=model_override or "whisper-1",
                )
                atomics.append(atomic)
                for a in extras[1:]:
                    atomic, _ = await self._facade.mark_audio_merged(a.id)
                    atomics.append(atomic)
        else:
            logger.info(
                f"Reusing streaming transcript for field_note={field_note_id} "
                f"(whisper 재전사 생략)"
            )

        return await self._facade.load_merged_transcript(field_note_id)

    async def _save_silence_markers(
        self,
        field_note_id: str,
        center_id: str,
        audio_bytes: bytes,
        fn,
        atomics: list,
    ) -> None:
        # 비언어 분석: 침묵 감지 (non-fatal)
        try:
            import json as _json

            markers = detect_silence_markers(audio_bytes)
            if markers:
                fn = fn or await self._facade.find_note(field_note_id, center_id)
                if fn:
                    atomic, _ = await self._facade.set_statuses(
                        field_note_id,
                        center_id,
                        nonverbal_markers=_json.dumps(markers, ensure_ascii=False),
                    )
                    atomics.append(atomic)
                    logger.info(
                        f"Saved {len(markers)} silence markers for field_note={field_note_id}"
                    )
        except Exception as e:
            logger.warning(f"Silence detection skipped (non-fatal): {e}")

    @staticmethod
    def _ctx(
        field_note_id: str,
        center_id: str,
        member_id: str | None,
    ) -> AICallContext:
        return AICallContext(
            center_id=center_id,
            source_type="field_note",
            source_id=field_note_id,
            purpose=AIPurpose.FIELD_NOTE_STT_PLAIN,
            pipeline_step="stt_transcribe",
            member_id=member_id,
        )
