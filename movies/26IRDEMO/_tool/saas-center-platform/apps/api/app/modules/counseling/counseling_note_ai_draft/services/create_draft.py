from ..models import CounselingNoteAiDraft
from ..repository import CounselingNoteAiDraftRepository


class CreateDraftService:
    def __init__(self, repo: CounselingNoteAiDraftRepository):
        self.repo = repo

    async def execute(
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
        # return
        return await self.repo.add(
            center_id=center_id,
            counseling_session_id=session_id,
            field_note_id=field_note_id,
            content=content,
            summary=summary,
            template_type=template_type,
            author_id=author_id,
            llm_call_id=llm_call_id,
        )
