import json
import re
from app.core.datetime_utils import utc_now

from app.infrastructure.llm.common.cost import estimate_cost
from app.core.logger import get_logger
from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository

logger = get_logger(__name__)


def _segments_to_lines(segments: list[dict]) -> str:
    return "\n".join(
        f"[{i+1}] {s.get('speaker','A')}: {s.get('text','')}"
        for i, s in enumerate(segments)
    )


def _apply_refined_lines(segments: list[dict], llm_output: str, *, offset: int = 0) -> list[dict]:
    # LLM plain text 응답 → segments의 text 교체. 파싱 실패 시 원본 유지.
    refined = [dict(s) for s in segments]
    for line in llm_output.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"\[(\d+)\]\s*\w+:\s*(.*)", line)
        if m:
            idx = int(m.group(1)) - 1 - offset
            if 0 <= idx < len(refined):
                refined[idx]["text"] = m.group(2).strip()
    return refined


def _try_parse_segments(text: str) -> list[dict] | None:
    if not text:
        return None
    # JSON 파싱 시도 — 실패 시 None 반환하여 plain text 모드로 fallback
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, list) and parsed:
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass  # 전체 텍스트 파싱 실패, 부분 추출 시도
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, list) and parsed:
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass  # 부분 추출도 실패, None 반환
    return None


class RunLLMExperimentService:
    def __init__(
        self,
        run_repo: LabExperimentRunRepository,
        ai,
    ) -> None:
        self._run_repo = run_repo
        self._ai = ai

    async def execute(
        self,
        *,
        experiment_type: str,
        field_note_id: str | None = None,
        sample_id: str | None = None,
        group_id: str | None = None,
        model_name: str,
        provider: str = "openai",
        prompt_version_id: str | None = None,
        model_params: dict | None = None,
        input_text: str,
        system_prompt: str,
        user_prompt: str,
        author_id: str | None = None,
        use_json_mode: bool = False,
        tags: str | None = None,
        memo: str | None = None,
    ) -> LabExperimentRun:
        # LLM 실험 실행: 프롬프트 + 입력 → API 호출 → 결과 저장.
        now = utc_now()

        run = await self._run_repo.add(
            experiment_type=experiment_type,
            field_note_id=field_note_id,
            sample_id=sample_id,
            group_id=group_id,
            provider=provider,
            model_name=model_name,
            model_params=json.dumps(model_params) if model_params else None,
            prompt_version_id=prompt_version_id,
            author_id=author_id,
            status="running",
            started_at=now,
            input_text=input_text[:5000],
            tags=tags,
            memo=memo,
        )

        facade = self._ai

        # 실험 실패 시 run.status="failed"로 기록해야 하므로 broad catch 사용
        try:
            if experiment_type == "llm_refine":
                result = await self._run_refine(
                    provider=provider,
                    model_name=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    input_text=input_text,
                )
            elif use_json_mode:
                result = await facade.run_experiment(
                    provider=provider,
                    model=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    json=True,
                    max_tokens=4096,
                )
            else:
                result = await facade.run_experiment(
                    provider=provider,
                    model=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_tokens=4096,
                )

            if experiment_type == "llm_refine":
                content, in_tok, out_tok, elapsed_ms = result
            else:
                content = result.content
                in_tok = result.input_tokens
                out_tok = result.output_tokens
                elapsed_ms = int(result.latency_ms)

            run.latency_ms = elapsed_ms
            run.input_tokens = in_tok
            run.output_tokens = out_tok
            run.total_tokens = in_tok + out_tok
            run.estimated_cost_usd = estimate_cost(model_name, in_tok, out_tok)
            run.output_text = content
            if use_json_mode:
                run.output_json = content
            run.status = "completed"
            run.completed_at = utc_now()

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = utc_now()
            logger.error(f"LLM experiment failed: {e}", exc_info=True)

        return run

    async def _run_refine(
        self,
        provider: str,
        model_name: str,
        system_prompt: str,
        user_prompt: str,
        input_text: str,
    ) -> tuple[str, int, int, int]:
        # 전사 보정: JSON 입력 → plain text 청크 분할 → LLM 호출 → JSON 결과 반환.
        facade = self._ai
        segments = _try_parse_segments(input_text) or _try_parse_segments(user_prompt)

        if not segments:
            logger.info(f"Refine: no JSON segments found, plain call (input[:80]={input_text[:80]!r})")
            result = await facade.run_experiment(
                provider=provider,
                model=model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=16384,
            )
            return result.content, result.input_tokens, result.output_tokens, int(result.latency_ms)

        CHUNK_SIZE = 80
        chunks = [segments[i:i + CHUNK_SIZE] for i in range(0, len(segments), CHUNK_SIZE)]
        logger.info(f"Refine: {len(segments)} segments → {len(chunks)} chunk(s)")

        all_refined: list[dict] = []
        total_in, total_out, total_ms = 0, 0, 0

        for ci, chunk in enumerate(chunks):
            offset = ci * CHUNK_SIZE
            lines_text = "\n".join(
                f"[{offset + i + 1}] {s.get('speaker', 'A')}: {s.get('text', '')}"
                for i, s in enumerate(chunk)
            )
            plain_user_prompt = f"다음 심리상담 녹취록을 교정해주세요:\n\n{lines_text}"

            result = await facade.run_experiment(
                provider=provider,
                model=model_name,
                system_prompt=system_prompt,
                user_prompt=plain_user_prompt,
                max_tokens=16384,
            )
            total_in += result.input_tokens
            total_out += result.output_tokens
            total_ms += int(result.latency_ms)

            refined_chunk = _apply_refined_lines(chunk, result.content, offset=offset)
            all_refined.extend(refined_chunk)
            logger.info(f"Refine chunk {ci+1}/{len(chunks)}: {len(chunk)} segs, tokens={result.input_tokens}+{result.output_tokens}")

        result_json = json.dumps(all_refined, ensure_ascii=False)
        logger.info(f"Refine done: {len(segments)} segments total, tokens={total_in}+{total_out}")
        return result_json, total_in, total_out, total_ms
