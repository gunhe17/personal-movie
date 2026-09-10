import json
import re

from app.core.logger import get_logger
from app.modules.field_note.facade import PipelineFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .prompt import REFINE_SYSTEM_PROMPT

logger = get_logger(__name__)

_CHUNK_SIZE = 80


class RefineTranscriptService:
    def __init__(
        self,
        facade: PipelineFacade,
        *,
        ai: AIFacade,
    ):
        self._facade = facade
        self._ai = ai

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        member_id: str | None = None,
    ) -> tuple[list[dict] | None, list]:
        segments = await self._facade.list_refine_segments(field_note_id)

        markers_json: str | None = None
        try:
            fn = await self._facade.find_note(field_note_id, center_id)
            if fn:
                markers_json = fn.nonverbal_markers
        except Exception:
            pass

        config = await self._ai.resolve_config(
            "refine", default_prompt=REFINE_SYSTEM_PROMPT
        )
        system_prompt = config.get("system_prompt") or REFINE_SYSTEM_PROMPT

        chunks = [
            segments[i : i + _CHUNK_SIZE] for i in range(0, len(segments), _CHUNK_SIZE)
        ]
        logger.info(f"Refine: {len(segments)} segments → {len(chunks)} chunk(s)")

        refined = []
        model_name = ""

        for ci, chunk in enumerate(chunks):
            offset = ci * _CHUNK_SIZE
            user_prompt = build_refine_prompt_with_markers(chunk, offset, markers_json)

            ctx = AICallContext(
                center_id=center_id,
                source_type="field_note",
                source_id=field_note_id,
                purpose=AIPurpose.FIELD_NOTE_REFINE,
                pipeline_step="refine",
                member_id=member_id,
            )
            result = await self._ai.generate_text(
                ctx,
                system_prompt,
                user_prompt,
                max_tokens=16384,
                resolved_config=config,
            )

            refined.extend(apply_refined_text(chunk, result.content, offset=offset))
            model_name = result.model

        refined_json = json.dumps(refined, ensure_ascii=False)
        atomic, _ = await self._facade.mark_transcript_refined(
            field_note_id,
            center_id,
            refined_json=refined_json,
            model=model_name or None,
        )
        return refined, [atomic]


def apply_refined_text(
    segments: list[dict],
    llm_output: str,
    *,
    offset: int = 0,
) -> list[dict]:
    """LLM plain text 응답을 파싱하여 segments의 text를 교체.

    예상 형식: [1] A: 보정된 텍스트
    파싱 실패 시 원본 유지.
    """
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


def build_refine_prompt(
    chunk: list[dict],
    offset: int,
) -> str:
    lines = [
        f"[{offset + i + 1}] {s.get('speaker', 'A')}: {s.get('text', '')}"
        for i, s in enumerate(chunk)
    ]
    return "다음 심리상담 녹취록을 교정해주세요:\n\n" + "\n".join(lines)


def build_refine_prompt_with_markers(
    chunk: list[dict],
    offset: int,
    markers_json: str | None,
) -> str:
    """침묵 마커가 없으면 build_refine_prompt와 동일하게 동작."""
    if not markers_json:
        return build_refine_prompt(chunk, offset)

    try:
        markers = json.loads(markers_json)
    except (json.JSONDecodeError, TypeError):
        return build_refine_prompt(chunk, offset)

    if not markers:
        return build_refine_prompt(chunk, offset)

    # 세그먼트와 침묵 마커를 (start, line) 튜플로 통합
    items: list[tuple[float, str]] = []
    for i, s in enumerate(chunk):
        start = s.get("start", 0.0)
        line = f"[{offset + i + 1}] {s.get('speaker', 'A')}: {s.get('text', '')}"
        items.append((start, line))

    # 청크 시간 범위 내의 침묵 마커만 삽입
    chunk_start = chunk[0].get("start", 0.0) if chunk else 0.0
    chunk_end = chunk[-1].get("end", chunk[-1].get("start", 0.0)) if chunk else 0.0
    for mk in markers:
        mk_start = mk.get("start", 0.0)
        if chunk_start <= mk_start <= chunk_end:
            duration = mk.get("duration", 0.0)
            items.append((mk_start, f"[--- {duration:.1f}초 침묵 ---]"))

    items.sort(key=lambda x: x[0])
    lines = [line for _, line in items]
    return (
        "다음 심리상담 녹취록을 교정해주세요. 침묵 표시는 그대로 유지하세요:\n\n"
        + "\n".join(lines)
    )
