from datetime import date

from sqlalchemy import Date as SQLDate
from sqlalchemy import cast, select

from app.core.datetime_utils import coerce_date
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingNote


class CounselingNoteRepository(PostgresRepository[CounselingNote]):
    model = CounselingNote

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_session_id: uuid_str,
        client_id: uuid_str,
        content: dict,
        author_id: uuid_str,
        summary: str | None = None,
    ) -> CounselingNote:
        return await super().add(
            CounselingNote(
                center_id=center_id,
                counseling_session_id=counseling_session_id,
                client_id=client_id,
                content=content,
                summary=summary,
                author_id=author_id,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        note_id: uuid_str,
        center_id: uuid_str,
        *,
        content: dict = unset,
        summary: str | None = unset,
    ) -> CounselingNote:
        await self.get_in_center(note_id=note_id, center_id=center_id)
        updated = await self.update_fields(
            note_id,
            content=content,
            summary=summary,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def list_written_session_id_set(self, session_ids: list[str]) -> set[str]:
        if not session_ids:
            return set()
        stmt = select(CounselingNote.counseling_session_id).where(
            CounselingNote.counseling_session_id.in_(session_ids),
            CounselingNote.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return {row for row in result.scalars().all()}


    @typecheck
    async def find_by_session_and_client(
        self,
        session_id: uuid_str,
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNote | None:
        return await self._find(
            where=[
                CounselingNote.counseling_session_id == session_id,
                CounselingNote.client_id == client_id,
                CounselingNote.center_id == center_id,
            ]
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 20,
        keyword: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
        session_ids: list[str] | None = None,
        client_ids: list[str] | None = None,
        author_ids: list[str] | None = None,
    ) -> tuple[list[CounselingNote], int]:
        # 앵커(id/session/client/author) 없이는 센터 전체 노트 덤프 금지
        if not (ids or session_ids or client_ids or author_ids):
            return [], 0
        where = [CounselingNote.center_id == center_id]
        if ids:
            where.append(CounselingNote.id.in_(ids))
        if session_ids:
            where.append(CounselingNote.counseling_session_id.in_(session_ids))
        if client_ids:
            where.append(CounselingNote.client_id.in_(client_ids))
        if author_ids:
            where.append(CounselingNote.author_id.in_(author_ids))
        if keyword:
            where.append(CounselingNote.summary.ilike(f"%{keyword}%"))
        if date_from:
            where.append(cast(CounselingNote.created_at, SQLDate) >= date_from)
        if date_to:
            where.append(cast(CounselingNote.created_at, SQLDate) <= date_to)
        rows = await self._filter(
            where=where, order_by="created_at", descending=sort != "asc", limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_by_session_and_client(
        self,
        session_id: uuid_str,
        client_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNote:
        note = await self.find_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )
        if note is None:
            raise EntityNotFoundException(
                f"CounselingNote not found for session: {session_id}, client: {client_id}"
            )
        return note

    @typecheck
    async def find_in_center(
        self,
        note_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNote | None:
        return await self._find(
            where=[
                CounselingNote.id == note_id,
                CounselingNote.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        note_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingNote:
        note = await self.find_in_center(note_id=note_id, center_id=center_id)
        if note is None:
            raise EntityNotFoundException(f"CounselingNote not found: {note_id}")
        return note

    @typecheck
    async def list_by_session(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
        client_id: uuid_str | None = None,
        keyword: str | None = None,
        author_id: uuid_str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[CounselingNote]:
        stmt = select(CounselingNote).where(
            CounselingNote.counseling_session_id == session_id,
            CounselingNote.center_id == center_id,
            CounselingNote.deleted_at.is_(None),
        )

        if client_id:
            stmt = stmt.where(CounselingNote.client_id == client_id)
        if keyword:
            stmt = stmt.where(CounselingNote.summary.ilike(f"%{keyword}%"))
        if author_id:
            stmt = stmt.where(CounselingNote.author_id == author_id)
        df = coerce_date(date_from, "date_from")
        if df:
            stmt = stmt.where(cast(CounselingNote.created_at, SQLDate) >= df)
        dt = coerce_date(date_to, "date_to")
        if dt:
            stmt = stmt.where(cast(CounselingNote.created_at, SQLDate) <= dt)

        stmt = stmt.order_by(CounselingNote.created_at.desc())
        return await self._scalars(stmt)

    @typecheck
    async def list_by_client(
        self,
        client_id: uuid_str,
        center_id: uuid_str,
        keyword: str | None = None,
        author_id: uuid_str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[CounselingNote]:
        conditions = [
            CounselingNote.center_id == center_id,
            CounselingNote.client_id == client_id,
        ]

        if keyword:
            conditions.append(CounselingNote.summary.ilike(f"%{keyword}%"))
        if author_id:
            conditions.append(CounselingNote.author_id == author_id)
        df = coerce_date(date_from, "date_from")
        if df:
            conditions.append(cast(CounselingNote.created_at, SQLDate) >= df)
        dt = coerce_date(date_to, "date_to")
        if dt:
            conditions.append(cast(CounselingNote.created_at, SQLDate) <= dt)

        return await self._filter(
            where=conditions,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_author_ids(
        self,
        author_ids: list[str],
        center_id: uuid_str,
        keyword: str | None = None,
        date_from: str | date | None = None,
        date_to: str | date | None = None,
    ) -> list[CounselingNote]:
        if not author_ids:
            return []

        conditions = [
            CounselingNote.center_id == center_id,
            CounselingNote.author_id.in_(author_ids),
        ]

        if keyword:
            conditions.append(CounselingNote.summary.ilike(f"%{keyword}%"))
        df = coerce_date(date_from, "date_from")
        if df:
            conditions.append(cast(CounselingNote.created_at, SQLDate) >= df)
        dt = coerce_date(date_to, "date_to")
        if dt:
            conditions.append(cast(CounselingNote.created_at, SQLDate) <= dt)

        return await self._filter(
            where=conditions,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_sessions(
        self,
        session_ids: list[str],
        center_id: uuid_str,
    ) -> list[CounselingNote]:
        if not session_ids:
            return []

        stmt = select(CounselingNote).where(
            CounselingNote.counseling_session_id.in_(session_ids),
            CounselingNote.center_id == center_id,
            CounselingNote.deleted_at.is_(None),
        )
        return await self._scalars(stmt)
