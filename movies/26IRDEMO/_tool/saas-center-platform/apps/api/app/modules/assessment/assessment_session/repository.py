from datetime import date

from sqlalchemy import func, select, update as sql_update

from .models import SessionStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentSession


class AssessmentSessionRepository(PostgresRepository[AssessmentSession]):
    model = AssessmentSession

    # #
    # command

    @typecheck
    async def update_status_by_case(
        self,
        case_id: uuid_str,
        *,
        from_status: str,
        to_status: str,
    ) -> list[AssessmentSession]:
        # bulk 전이 — 영향 행을 RETURNING으로 반환(사실 누락 방지)
        stmt = (
            sql_update(AssessmentSession)
            .where(
                AssessmentSession.case_id == case_id,
                AssessmentSession.status == from_status,
                AssessmentSession.deleted_at.is_(None),
            )
            .values(status=to_status)
            .returning(AssessmentSession)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        schedule_id: uuid_str | None = None,
        status: str = "scheduled",
    ) -> AssessmentSession:
        return await super().add(
            AssessmentSession(
                center_id=center_id,
                case_id=case_id,
                schedule_id=schedule_id,
                status=status,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
        *,
        status: str = unset,
        cancel_reason: str | None = unset,
    ) -> AssessmentSession:
        await self.get_in_center(center_id=center_id, session_id=session_id)
        updated = await self.update_fields(
            session_id,
            status=status,
            cancel_reason=cancel_reason,
        )
        assert updated is not None
        return updated

    @typecheck
    async def update_in_place(
        self,
        session_id: uuid_str,
        *,
        status: str = unset,
    ) -> AssessmentSession | None:
        return await self.update_fields(session_id, status=status)

    @typecheck
    async def remove_by_case(self, case_id: uuid_str) -> list[AssessmentSession]:
        # bulk soft-delete — 영향 행을 RETURNING으로 반환(per-row atomic 사실 기록)
        stmt = (
            sql_update(AssessmentSession)
            .where(
                AssessmentSession.case_id == case_id,
                AssessmentSession.deleted_at.is_(None),
            )
            .values(deleted_at=func.now())
            .returning(AssessmentSession)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        session_id: uuid_str,
    ) -> AssessmentSession | None:
        return await self._find(
            where=[
                AssessmentSession.center_id == center_id,
                AssessmentSession.id == session_id,
            ]
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 20,
        status: str | None = None,
        case_ids: list[str] | None = None,
        schedule_ids: list[str] | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[AssessmentSession], int]:
        where = [AssessmentSession.center_id == center_id]
        if ids is not None:
            where.append(AssessmentSession.id.in_(ids))
        if case_ids:
            where.append(AssessmentSession.case_id.in_(case_ids))
        if schedule_ids:
            where.append(AssessmentSession.schedule_id.in_(schedule_ids))
        if status:
            where.append(AssessmentSession.status == status)
        rows = await self._filter(
            where=where, order_by="created_at", descending=sort != "asc", limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        session_id: uuid_str,
    ) -> AssessmentSession:
        session = await self.find_in_center(center_id=center_id, session_id=session_id)
        if session is None:
            raise EntityNotFoundException(f"AssessmentSession not found: {session_id}")
        return session

    @typecheck
    async def list_by_case(self, case_id: uuid_str) -> list[AssessmentSession]:
        return await self._filter(
            where=[AssessmentSession.case_id == case_id],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_filters(
        self,
        center_id: uuid_str,
        case_id: uuid_str | None = None,
        schedule_id: uuid_str | None = None,
        schedule_ids: list[uuid_str] | None = None,
        status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[AssessmentSession]:
        where = [AssessmentSession.center_id == center_id]
        if case_id:
            where.append(AssessmentSession.case_id == case_id)
        if schedule_id:
            where.append(AssessmentSession.schedule_id == schedule_id)
        if schedule_ids:
            where.append(AssessmentSession.schedule_id.in_(schedule_ids))
        if status:
            where.append(AssessmentSession.status == status)
        if date_from:
            where.append(func.date(AssessmentSession.created_at) >= date_from)
        if date_to:
            where.append(func.date(AssessmentSession.created_at) <= date_to)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            offset=offset,
            limit=limit,
        )

    @typecheck
    async def count_by_case(self, case_id: uuid_str) -> int:
        return await self._count(where=[AssessmentSession.case_id == case_id])

    @typecheck
    async def list_by_schedule_ids(
        self, schedule_ids: list[str]
    ) -> list[AssessmentSession]:
        if not schedule_ids:
            return []
        return await self._filter(
            where=[AssessmentSession.schedule_id.in_(schedule_ids)]
        )

    @typecheck
    async def list_by_case_ids(self, case_ids: list[str]) -> list[AssessmentSession]:
        if not case_ids:
            return []
        return await self._filter(where=[AssessmentSession.case_id.in_(case_ids)])

    @typecheck
    async def list_by_ids(
        self,
        ids: list[str],
        center_id: uuid_str,
    ) -> list[AssessmentSession]:
        if not ids:
            return []
        return await self._filter(
            where=[
                AssessmentSession.id.in_(ids),
                AssessmentSession.center_id == center_id,
            ]
        )

    @typecheck
    async def aggregate_active_case_map_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> dict[str, str]:
        if not schedule_ids:
            return {}
        stmt = select(
            AssessmentSession.schedule_id,
            AssessmentSession.case_id,
        ).where(
            AssessmentSession.schedule_id.in_(schedule_ids),
            AssessmentSession.status != SessionStatus.CANCELLED,
            AssessmentSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return {row.schedule_id: row.case_id for row in result.all()}

    @typecheck
    async def list_cancelled_by_case(
        self, case_id: uuid_str
    ) -> list[AssessmentSession]:
        return await self._filter(
            where=[
                AssessmentSession.case_id == case_id,
                AssessmentSession.status == SessionStatus.CANCELLED,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def count_active_by_schedule_id(
        self,
        schedule_id: uuid_str,
        exclude_session_ids: list[str] | None = None,
    ) -> int:
        where = [
            AssessmentSession.schedule_id == schedule_id,
            AssessmentSession.status != SessionStatus.CANCELLED,
        ]
        if exclude_session_ids:
            where.append(AssessmentSession.id.notin_(exclude_session_ids))
        return await self._count(where=where)
