# 상담일지 초안 생성 — 녹취록+요약+메모 → LLM JSON → counseling 노트 upsert.
# 쓰기는 owning 모듈 facade(CounselingNoteFacade) 직접 — runtime→application 역행 금지.
import json
from uuid import uuid4

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.counseling.facade import (
    CounselingNoteAiDraftFacade,
    CounselingNoteFacade,
)
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .prompt import COUNSELING_NOTE_SYSTEM_PROMPT, NOTE_TEMPLATE_REGISTRY


class GenerateCounselingNoteService:
    def __init__(
        self,
        uow: UnitOfWork,
        *,
        ai: AIFacade,
    ):
        self._uow = uow
        self._note_facade = CounselingNoteFacade(uow)
        self._draft_facade = CounselingNoteAiDraftFacade(uow)
        self._ai = ai

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        session_id: str,
        client_ids: list[str],
        author_id: str,
        transcript_text: str,
        entries_text: str,
        summary_text: str,
        total_duration: float,
        note_template_type: str | None = None,
    ) -> str:
        template_type = note_template_type or "default"
        config = await self._ai.resolve_config(
            "counseling_note",
            default_prompt=COUNSELING_NOTE_SYSTEM_PROMPT,
        )
        system_prompt = (
            config.get("system_prompt")
            or NOTE_TEMPLATE_REGISTRY.get(template_type)
            or COUNSELING_NOTE_SYSTEM_PROMPT
        )

        duration_min = int(total_duration // 60)
        user_prompt = f"""다음은 {duration_min}분간 진행된 심리상담 회기의 녹취록, 상담사 메모, AI 요약입니다.

--- 녹취록 ---
{transcript_text[:8000]}

--- 상담사 메모/태그 ---
{entries_text[:2000]}

--- AI 요약 ---
{summary_text[:1000]}

위 내용을 바탕으로 상담일지를 JSON 형식으로 작성해주세요."""

        ctx = AICallContext(
            center_id=center_id,
            source_type="field_note",
            source_id=field_note_id,
            purpose=AIPurpose.FIELD_NOTE_GENERATE_NOTE,
            pipeline_step="counseling_note",
            member_id=author_id or None,
        )
        result = await self._ai.generate_json(
            ctx,
            system_prompt,
            user_prompt,
            resolved_config=config,
        )

        note_content = json.loads(result.content)
        if isinstance(note_content.get("intervention"), str):
            note_content["intervention"] = [note_content["intervention"]]

        summary_value = summary_text[:1000] if summary_text != "(요약 없음)" else None
        # 웹은 /ai-drafts 에 새 행이 생기는 것으로 생성 완료를 판정한다
        # (field-note-service.ts generateCounselingNoteDraft 폴링). 이 행이 없으면
        # counseling_notes 만 갱신되고 화면은 폴링 상한까지 "전사 분석 중…"에 머문다.
        await self._draft_facade.create_draft(
            center_id=center_id,
            session_id=session_id,
            field_note_id=field_note_id,
            content=note_content,
            summary=summary_value,
            template_type=template_type,
            author_id=author_id,
            llm_call_id=result.llm_call_id,
        )

        atomics = []
        for client_id in client_ids:
            atomic, _ = await self._note_facade.upsert_generated_note(
                session_id=session_id,
                client_id=client_id,
                center_id=center_id,
                author_id=author_id,
                content=note_content,
                summary=summary_value,
            )
            atomics.append(atomic)

        event_group_id = str(uuid4())
        await emit(
            self._uow,
            "field_note_counseling_notes_generated",
            event_group_id=event_group_id,
            atomics=atomics,
            center_id=center_id,
            actor_id=author_id or None,
        )
        return event_group_id
