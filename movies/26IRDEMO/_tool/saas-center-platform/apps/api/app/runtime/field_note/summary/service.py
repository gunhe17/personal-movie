import json

from app.core.logger import get_logger
from app.modules.field_note.facade import PipelineFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .parsing import ground_quote_timestamps, parse_analysis
from .prompt import ASSESSMENT_ANALYSIS_SYSTEM_PROMPT, SUMMARY_ANALYSIS_SYSTEM_PROMPT

logger = get_logger(__name__)


class SummarizeFieldNoteService:
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
    ) -> tuple[str | None, list]:
        # 평문 summary 와 구조화 analysis(AI 분석 탭 노출용)를 함께 저장한다.
        context = await self._facade.load_summary_context(field_note_id, center_id)
        field_note = context["field_note"]
        transcript_text = context["transcript_text"]
        entries = context["entries"]

        entry_lines = []
        for entry in entries:
            minutes, seconds = divmod(int(entry.timestamp_seconds), 60)
            if entry.entry_type == "memo":
                entry_lines.append(
                    f"[{minutes:02d}:{seconds:02d}] 메모: {entry.content}"
                )
            elif entry.entry_type == "tag":
                category = entry.tag_category or "기타"
                entry_lines.append(
                    f"[{minutes:02d}:{seconds:02d}] #{category}: {entry.content}"
                )
        entries_text = "\n".join(entry_lines) if entry_lines else "(메모/태그 없음)"

        total_min = int(field_note.total_duration / 60)
        total_sec = int(field_note.total_duration % 60)

        # 검사 항목(task) 연결 노트는 검사 렌즈로 분기 (field_note 자기 컬럼만 읽음 — cross-module 의존 없음).
        # 검사: 해석 금지·verbatim 정리 / 상담: 요약·정서·이슈.
        is_assessment = bool(field_note.task_id)
        actor_label = "검사자" if is_assessment else "상담사"
        context_label = "검사 정보" if is_assessment else "회기 정보"

        user_prompt = f"""## 녹취록
{transcript_text}

## {actor_label} 메모/태그
{entries_text}

## {context_label}
- 총 녹음 시간: {total_min}분 {total_sec}초"""

        if is_assessment:
            config = await self._ai.resolve_config(
                "summary_assessment", default_prompt=ASSESSMENT_ANALYSIS_SYSTEM_PROMPT
            )
            default_prompt = ASSESSMENT_ANALYSIS_SYSTEM_PROMPT
        else:
            config = await self._ai.resolve_config(
                "summary", default_prompt=SUMMARY_ANALYSIS_SYSTEM_PROMPT
            )
            default_prompt = SUMMARY_ANALYSIS_SYSTEM_PROMPT
        system_prompt = config.get("system_prompt") or default_prompt

        ctx = AICallContext(
            center_id=center_id,
            source_type="field_note",
            source_id=field_note_id,
            purpose=AIPurpose.FIELD_NOTE_SUMMARIZE,
            pipeline_step="summary",
            member_id=member_id,
        )
        # 분석 차원이 늘어(narrative·정서흐름·인용·살펴볼지점) 기본 2048로는 잘릴 수 있어 상향.
        result = await self._ai.generate_json(
            ctx,
            system_prompt,
            user_prompt,
            resolved_config=config,
            max_tokens=4096,
        )

        # 구조화 JSON 파싱 — 실패 시 평문 요약으로 안전 폴백(analysis=None).
        # max_seconds 로 회기 길이를 넘는 과추정 타임스탬프 클램프.
        summary_text, analysis_json = parse_analysis(
            result.content,
            max_seconds=field_note.total_duration,
        )

        # key_quotes 타임스탬프를 전사 실제 위치로 보정(LLM 시각 오추정 방어 — verbatim 매칭).
        if analysis_json:
            try:
                _adict = json.loads(analysis_json)
                _adict = ground_quote_timestamps(_adict, context["segments"])
                analysis_json = json.dumps(_adict, ensure_ascii=False)
            except Exception:
                pass  # 그라운딩 실패해도 분석 저장은 계속

        atomic, _ = await self._facade.mark_summary_completed(
            field_note_id,
            center_id,
            summary_text=summary_text,
            model=result.model,
            analysis_json=analysis_json,
        )

        logger.info(
            f"Summary generated for field_note={field_note_id}, model={result.model}, "
            f"structured={analysis_json is not None}"
        )
        return summary_text, [atomic]
