import json

from app.core.logger import get_logger
from app.modules.field_note.facade import FieldNoteDiarizationStatus, PipelineFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .speaker_roles import infer_speaker_roles
from .text_diarize import label_speakers

logger = get_logger(__name__)


class DiarizeTranscriptService:
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
        # diarization_strategy 설정값:
        # - "integrated" (기본): OpenAI diarize 모델이 전사+화자분리 동시 수행
        # - "specialized": Whisper 전사 → pyannote 화자분리 → 타임스탬프 정렬
        config = await self._ai.resolve_config("stt_diarize")
        model_override = config.get("model_name")
        strategy = config.get("diarization_strategy") or "integrated"

        audios = await self._facade.list_audios(field_note_id)
        if not audios:
            raise RuntimeError(f"No audio chunks found for field_note={field_note_id}")

        duration_seconds = sum(a.duration for a in audios)

        ctx = AICallContext(
            center_id=center_id,
            source_type="field_note",
            source_id=field_note_id,
            purpose=AIPurpose.FIELD_NOTE_STT_DIARIZE,
            pipeline_step="stt_diarize",
            member_id=member_id,
        )

        # 라이브 전사 재사용 필드노트: 저장된 전사에 LLM 화자 라벨만 부여(text-diarize, 재전사 없음).
        # 음향 재전사(integrated/specialized)와 달리 전사 텍스트를 새로 만들지 않아 사용자가 본 자막과 일치.
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
            # 청크별 전사(세션 상대시간)를 누적 오프셋으로 합성 — 이어/추가 녹음 세션의
            # 전사까지 포함해 라벨링한다 (첫 청크만 읽으면 이어 녹음분이 누락됨).
            stored = await self._facade.load_merged_transcript(field_note_id)
            labeled = await label_speakers(self._ai, stored.get("segments", []) or [])
            diarize_result = {"text": stored.get("text", ""), "segments": labeled}
            stt_model = "text-diarize"
        else:
            combined_audio = await self._facade.merge_audio_bytes(audios, self._storage)
            if not combined_audio:
                raise RuntimeError("No audio data collected")
            audio_bytes = bytes(combined_audio)
            if strategy == "specialized":
                diarize_result = await self._specialized_transcribe(
                    ctx,
                    audio_bytes,
                    model_override=model_override,
                )
            else:
                stt_result = await self._ai.transcribe_with_diarization(
                    ctx,
                    audio_bytes,
                    model_override=model_override,
                )
                diarize_result = {
                    "text": stt_result.text,
                    "segments": stt_result.segments,
                }
            stt_model = model_override or "default"

        # 화자분리 결과는 전체 노트의 절대시간 전사 — 첫 청크에 단일 소스로 저장하고,
        # 다른 청크의 세션별 전사는 비운다(합성 소비자들이 같은 내용을 이중 합산하지 않게).
        atomic, _ = await self._facade.mark_audio_diarized(
            audios[0].id,
            diarize_result=diarize_result,
            stt_model=stt_model,
        )
        atomics.append(atomic)
        for a in audios[1:]:
            if a.diarized_transcript:
                atomic, _ = await self._facade.clear_audio_transcript(a.id)
                atomics.append(atomic)

        fn = await self._facade.find_note(field_note_id, center_id)
        if fn:
            # 화자 역할 추론 — 사용자가 이미 이름을 지정했으면(speaker_map 존재) 덮어쓰지 않는다.
            speaker_map_json = None
            if not (fn.speaker_map and fn.speaker_map.strip()):
                try:
                    role_map = await infer_speaker_roles(self._ai, ctx, diarize_result)
                    if role_map:
                        speaker_map_json = json.dumps(role_map, ensure_ascii=False)
                except Exception as e:
                    logger.warning(f"Speaker role inference skipped (non-fatal): {e}")
            if speaker_map_json is not None:
                atomic, _ = await self._facade.set_statuses(
                    field_note_id,
                    center_id,
                    diarization_status=FieldNoteDiarizationStatus.COMPLETED,
                    speaker_map=speaker_map_json,
                )
                atomics.append(atomic)
            else:
                atomic, _ = await self._facade.set_statuses(
                    field_note_id,
                    center_id,
                    diarization_status=FieldNoteDiarizationStatus.COMPLETED,
                )
                atomics.append(atomic)

        # 과금: 전략 무관 길이 기반 — 환산·차감은 게이트웨이 bill_diarize 소유
        await self._ai.bill_diarize(
            ctx,
            duration_seconds=duration_seconds,
            model=stt_model,
        )

        return diarize_result, atomics

    async def _specialized_transcribe(
        self,
        ctx: AICallContext,
        audio_bytes: bytes,
        *,
        model_override: str | None = None,
    ) -> dict:
        from app.infrastructure.stt.factory import get_diarization_client
        from app.infrastructure.stt.pyannote.client import (
            align_transcript_with_speakers,
        )
        from app.infrastructure.stt.common.schemas import TranscriptSegment

        diarize_client = get_diarization_client()
        if not diarize_client:
            logger.warning(
                "Specialized diarization unavailable (no HF token), "
                "falling back to integrated strategy"
            )
            stt_result = await self._ai.transcribe_with_diarization(
                ctx,
                audio_bytes,
                model_override=model_override,
            )
            return {"text": stt_result.text, "segments": stt_result.segments}

        stt_result = await self._ai.transcribe_with_timestamps(
            ctx,
            audio_bytes,
            model_override=model_override,
        )
        transcript_segments = [
            TranscriptSegment(text=s["text"], start=s["start"], end=s["end"])
            for s in stt_result.segments
        ]

        speaker_segments = await diarize_client.diarize(audio_bytes)

        aligned = align_transcript_with_speakers(transcript_segments, speaker_segments)

        text = " ".join(s["text"] for s in aligned)
        logger.info(
            f"Specialized transcribe done: {len(aligned)} segments, "
            f"{len(set(s['speaker'] for s in aligned))} speakers"
        )
        return {"text": text, "segments": aligned}
