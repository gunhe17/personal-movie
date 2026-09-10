from datetime import datetime

from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingNoteShare, NoteShareStatus


class CounselingNoteShareRepository(PostgresRepository[CounselingNoteShare]):
    model = CounselingNoteShare

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_session_id: uuid_str,
        client_id: uuid_str,
        content: dict,
        audience: str,
        author_id: uuid_str,
        counseling_note_id: uuid_str | None = None,
        llm_call_id: uuid_str | None = None,
    ) -> CounselingNoteShare:
        return await super().add(
            CounselingNoteShare(
                center_id=center_id,
                counseling_session_id=counseling_session_id,
                client_id=client_id,
                counseling_note_id=counseling_note_id,
                author_id=author_id,
                llm_call_id=llm_call_id,
                audience=audience,
                status=NoteShareStatus.DRAFT,
                content=content,
                is_edited=False,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        share_id: uuid_str,
        center_id: uuid_str,
        *,
        content: dict = unset,
        audience: str = unset,
        status: str = unset,
        is_edited: bool = unset,
        published_at: datetime | None = unset,
        counseling_note_id: uuid_str | None = unset,
        llm_call_id: uuid_str | None = unset,
        author_id: uuid_str = unset,
    ) -> CounselingNoteShare:
        await self.get_in_center(share_id=share_id, center_id=center_id)
        updated = await self.update_fields(
            share_id,
            content=content,
            audience=audience,
            status=status,
            is_edited=is_edited,
            published_at=published_at,
            counseling_note_id=counseling_note_id,
            llm_call_id=llm_call_id,
            author_id=author_id,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        share_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNoteShare:
        share = await self._find(
            where=[
                CounselingNoteShare.id == share_id,
                CounselingNoteShare.center_id == center_id,
            ]
        )
        if share is None:
            raise EntityNotFoundException(f"CounselingNoteShare not found: {share_id}")
        return share

    @typecheck
    async def find_by_session_and_client(
        self,
        session_id: uuid_str,
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNoteShare | None:
        return await self._find(
            where=[
                CounselingNoteShare.counseling_session_id == session_id,
                CounselingNoteShare.client_id == client_id,
                CounselingNoteShare.center_id == center_id,
            ]
        )

    @typecheck
    async def list_by_session(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingNoteShare]:
        return await self._filter(
            where=[
                CounselingNoteShare.counseling_session_id == session_id,
                CounselingNoteShare.center_id == center_id,
            ],
            order_by="created_at",
        )

    @typecheck
    async def list_published_by_sessions(
        self,
        session_ids: list[str],
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingNoteShare]:
        if not session_ids:
            return []
        return await self._filter(
            where=[
                CounselingNoteShare.counseling_session_id.in_(session_ids),
                CounselingNoteShare.client_id == client_id,
                CounselingNoteShare.center_id == center_id,
                CounselingNoteShare.status == NoteShareStatus.PUBLISHED,
            ],
            order_by="published_at",
        )
