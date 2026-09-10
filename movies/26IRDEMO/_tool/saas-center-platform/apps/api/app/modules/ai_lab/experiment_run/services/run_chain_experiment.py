import json
import time
from app.core.datetime_utils import utc_now

from app.infrastructure.llm.common.cost import estimate_stt_cost, estimate_cost
from app.core.logger import get_logger
from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository
from .run_llm_experiment import _segments_to_lines, _apply_refined_lines

logger = get_logger(__name__)

_DIARIZE_NATIVE_MODELS = {"gpt-4o-transcribe-diarize"}

CHUNK_SIZE = 80


class RunChainExperimentService:
    # STT 화자분리 → LLM 전사 보정을 단일 실험으로 실행.

    def __init__(
        self,
        repo: LabExperimentRunRepository,
        ai,
    ) -> None:
        self.repo = repo
        self.ai = ai

    async def execute(
        self,
        *,
        sample_id: str | None = None,
        group_id: str | None = None,
        stt_model_name: str = "gpt-4o-transcribe-diarize",
        llm_model_name: str = "gpt-4.1",
        provider: str = "openai",
        system_prompt: str = "",
        model_params: dict | None = None,
        audio_bytes: bytes,
        audio_duration: float,
        audio_filename: str = "audio.webm",
        tags: str | None = None,
        memo: str | None = None,
    ) -> LabExperimentRun:
        now = utc_now()

        run = await self.repo.add(
            experiment_type="chain_stt_refine",
            sample_id=sample_id,
            group_id=group_id,
            provider=provider,
            model_name=f"{stt_model_name} + {llm_model_name}",
            model_params=json.dumps(model_params) if model_params else None,
            status="running",
            started_at=now,
            input_audio_duration=audio_duration,
            tags=tags,
            memo=memo,
        )

        try:
            t0 = time.monotonic()

            # ── Step 1: STT 화자분리 ──
            # (구현이 native/비-native 동일 호출이던 기존 분기 형태를 단일 호출로 보존)
            stt_result = await self.ai.experiment_transcribe_with_diarization(
                audio_bytes,
                model=stt_model_name,
                language="ko",
                model_override=stt_model_name,
                filename=audio_filename,
                known_duration=audio_duration,
            )

            stt_elapsed_ms = int((time.monotonic() - t0) * 1000)
            segments = stt_result.get("segments", [])
            stt_text = stt_result.get("text", "")

            logger.info(
                f"Chain STT done: {len(segments)} segments, "
                f"{stt_elapsed_ms}ms, model={stt_model_name}"
            )

            if not segments:
                # 세그먼트 없으면 STT 결과만 반환
                elapsed_ms = int((time.monotonic() - t0) * 1000)
                run.latency_ms = elapsed_ms
                run.output_text = stt_text
                run.output_json = json.dumps({
                    "stt_result": stt_result,
                    "refine_result": None,
                    "stt_model": stt_model_name,
                    "llm_model": llm_model_name,
                    "stt_latency_ms": stt_elapsed_ms,
                    "refine_latency_ms": 0,
                    "used_system_prompt": system_prompt,
                }, ensure_ascii=False)
                run.estimated_cost_usd = estimate_stt_cost(stt_model_name, audio_duration)
                run.status = "completed"
                run.completed_at = utc_now()
                return run

            # ── Step 2: LLM 전사 보정 ──
            t1 = time.monotonic()
            facade = self.ai

            chunks = [segments[i:i + CHUNK_SIZE] for i in range(0, len(segments), CHUNK_SIZE)]
            logger.info(f"Chain refine: {len(segments)} segments → {len(chunks)} chunk(s)")

            all_refined: list[dict] = []
            total_in_tok, total_out_tok = 0, 0

            for ci, chunk in enumerate(chunks):
                offset = ci * CHUNK_SIZE
                lines_text = _segments_to_lines(
                    [{"speaker": s.get("speaker", "A"), "text": s.get("text", "")} for s in chunk]
                )
                # offset 보정: _segments_to_lines는 1부터 시작하므로 offset 적용
                lines_text = "\n".join(
                    f"[{offset + i + 1}] {s.get('speaker', 'A')}: {s.get('text', '')}"
                    for i, s in enumerate(chunk)
                )
                user_prompt = f"다음 심리상담 녹취록을 교정해주세요:\n\n{lines_text}"

                result = await facade.run_experiment(
                    provider="openai",
                    model=llm_model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_tokens=16384,
                )
                total_in_tok += result.input_tokens
                total_out_tok += result.output_tokens

                refined_chunk = _apply_refined_lines(chunk, result.content, offset=offset)
                all_refined.extend(refined_chunk)
                logger.info(
                    f"Chain refine chunk {ci+1}/{len(chunks)}: "
                    f"{len(chunk)} segs, tokens={result.input_tokens}+{result.output_tokens}"
                )

            refine_elapsed_ms = int((time.monotonic() - t1) * 1000)
            total_elapsed_ms = int((time.monotonic() - t0) * 1000)

            # 보정 결과 텍스트 조합
            refined_text = "\n".join(
                f"{s.get('speaker', 'A')}: {s.get('text', '')}" for s in all_refined
            )

            # 결과 저장
            run.latency_ms = total_elapsed_ms
            run.input_tokens = total_in_tok
            run.output_tokens = total_out_tok
            run.total_tokens = total_in_tok + total_out_tok
            run.output_text = refined_text
            run.output_json = json.dumps({
                "stt_result": stt_result,
                "refine_result": all_refined,
                "stt_model": stt_model_name,
                "llm_model": llm_model_name,
                "stt_latency_ms": stt_elapsed_ms,
                "refine_latency_ms": refine_elapsed_ms,
                "stt_segments_count": len(segments),
                "refined_segments_count": len(all_refined),
                "used_system_prompt": system_prompt,
            }, ensure_ascii=False)

            stt_cost = estimate_stt_cost(stt_model_name, audio_duration)
            llm_cost = estimate_cost(llm_model_name, total_in_tok, total_out_tok)
            run.estimated_cost_usd = stt_cost + llm_cost

            run.status = "completed"
            run.completed_at = utc_now()

            logger.info(
                f"Chain experiment done: STT {stt_elapsed_ms}ms + Refine {refine_elapsed_ms}ms = {total_elapsed_ms}ms, "
                f"segments={len(segments)}, cost=${run.estimated_cost_usd:.4f}"
            )

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = utc_now()
            logger.error(f"Chain experiment failed: {e}", exc_info=True)

        return run
