from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingNoteAiDraft


class CounselingNoteAiDraftRepository(PostgresRepository[CounselingNoteAiDraft]):
    model = CounselingNoteAiDraft

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_session_id: uuid_str,
        field_note_id: uuid_str,
        content: dict,
        template_type: str,
        author_id: uuid_str,
        summary: str | None = None,
        llm_call_id: uuid_str | None = None,
    ) -> CounselingNoteAiDraft:
        return await super().add(
            CounselingNoteAiDraft(
                center_id=center_id,
                counseling_session_id=counseling_session_id,
                field_note_id=field_note_id,
                content=content,
                summary=summary,
                template_type=template_type,
                llm_call_id=llm_call_id,
                author_id=author_id,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_session(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingNoteAiDraft]:
        return await self._filter(
            where=[
                CounselingNoteAiDraft.counseling_session_id == session_id,
                CounselingNoteAiDraft.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )
