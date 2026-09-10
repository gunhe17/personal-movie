from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_note_ai_draft.models import CounselingNoteAiDraft
from ..counseling_note_ai_draft.repository import CounselingNoteAiDraftRepository
from ..counseling_note_ai_draft.schemas import CounselingNoteAiDraftResponse
from ..counseling_note_ai_draft.services import (
    CreateDraftService,
    ListDraftsBySessionService,
)


class CounselingNoteAiDraftFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_draft(
        self,
        *,
        center_id: str,
        session_id: str,
        field_note_id: str,
        content: dict,
        summary: str | None,
        template_type: str,
        author_id: str,
        llm_call_id: str | None,
    ) -> CounselingNoteAiDraft:
        repo = self._uow.repo(CounselingNoteAiDraftRepository)
        service = CreateDraftService(repo)
        return await service.execute(
            center_id=center_id,
            session_id=session_id,
            field_note_id=field_note_id,
            content=content,
            summary=summary,
            template_type=template_type,
            author_id=author_id,
            llm_call_id=llm_call_id,
        )

    async def list_drafts_by_session(
        self,
        *,
        session_id: str,
        center_id: str,
    ) -> list[CounselingNoteAiDraft]:
        repo = self._uow.repo(CounselingNoteAiDraftRepository)
        service = ListDraftsBySessionService(repo)
        return await service.execute(session_id=session_id, center_id=center_id)

    async def list_drafts_by_session_with_response(
        self,
        *,
        session_id: str,
        center_id: str,
    ) -> list[CounselingNoteAiDraftResponse]:
        drafts = await self.list_drafts_by_session(
            session_id=session_id,
            center_id=center_id,
        )
        return [CounselingNoteAiDraftResponse.model_validate(d) for d in drafts]
