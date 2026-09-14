from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingNoteDerivation


class CounselingNoteDerivationRepository(PostgresRepository[CounselingNoteDerivation]):
    model = CounselingNoteDerivation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_note_id: uuid_str,
        counseling_session_id: uuid_str,
        client_id: uuid_str,
        author_id: uuid_str,
        kind: str,
        generated_content: dict,
        content: dict,
        llm_call_id: uuid_str | None = None,
    ) -> CounselingNoteDerivation:
        return await super().add(
            CounselingNoteDerivation(
                center_id=center_id,
                counseling_note_id=counseling_note_id,
                counseling_session_id=counseling_session_id,
                client_id=client_id,
                author_id=author_id,
                llm_call_id=llm_call_id,
                status="draft",
                kind=kind,
                generated_content=generated_content,
                content=content,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_session(
        self,
        counseling_session_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingNoteDerivation]:
        return await self._filter(
            where=[
                CounselingNoteDerivation.counseling_session_id == counseling_session_id,
                CounselingNoteDerivation.center_id == center_id,
            ],
            order_by="created_at",
        )
