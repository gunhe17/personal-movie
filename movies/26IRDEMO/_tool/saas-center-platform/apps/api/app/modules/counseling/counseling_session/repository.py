from datetime import date, datetime

from sqlalchemy import func, select

from .models import CounselingSession, CounselingSessionStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository



class CounselingSessionRepository(PostgresRepository[CounselingSession]):
    model = CounselingSession

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_case_id: uuid_str,
        schedule_id: uuid_str,
        status: str,
        session_number: int | None = None,
        cancel_reason: str | None = None,
        completed_at: datetime | None = None,
    ) -> CounselingSession:
        return await super().add(
            CounselingSession(
                center_id=center_id,
                counseling_case_id=counseling_case_id,
                schedule_id=schedule_id,
                status=status,
                session_number=session_number,
                cancel_reason=cancel_reason,
                completed_at=completed_at,
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
        completed_at: datetime | None = unset,
    ) -> CounselingSession:
        await self.get_in_center(session_id=session_id, center_id=center_id)
        updated = await self.update_fields(
            session_id,
            status=status,
            cancel_reason=cancel_reason,
            completed_at=completed_at,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def list_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingSession]:
        stmt = (
            select(CounselingSession)
            .where(
                CounselingSession.counseling_case_id == case_id,
                CounselingSession.center_id == center_id,
                CounselingSession.deleted_at.is_(None),
            )
            .order_by(CounselingSession.created_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_filtered(
        self,
        center_id: uuid_str,
        case_id: uuid_str | None = None,
        status: str | None = None,
        schedule_id: uuid_str | None = None,
        schedule_ids: list[str] | None = None,
        session_number_min: int | None = None,
        session_number_max: int | None = None,
        *,
        limit: int = 50,
    ) -> list[CounselingSession]:
        conditions = [
            CounselingSession.center_id == center_id,
        ]

        if case_id:
            conditions.append(CounselingSession.counseling_case_id == case_id)
        if status:
            conditions.append(CounselingSession.status == status)
        if schedule_id:
            conditions.append(CounselingSession.schedule_id == schedule_id)
        if schedule_ids is not None:
            if not schedule_ids:
                return []
            conditions.append(CounselingSession.schedule_id.in_(schedule_ids))
        if session_number_min is not None:
            conditions.append(CounselingSession.session_number >= session_number_min)
        if session_number_max is not None:
            conditions.append(CounselingSession.session_number <= session_number_max)

        return await self._filter(
            where=conditions,
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def find_in_center(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingSession | None:
        stmt = select(CounselingSession).where(
            CounselingSession.id == session_id,
            CounselingSession.center_id == center_id,
            CounselingSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 20,
        status: str | None = None,
        session_number_min: int | None = None,
        session_number_max: int | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        case_ids: list[str] | None = None,
        schedule_ids: list[str] | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[CounselingSession], int]:
        from sqlalchemy import Date as SQLDate
        from sqlalchemy import cast

        where = [CounselingSession.center_id == center_id]
        if ids is not None:
            where.append(CounselingSession.id.in_(ids))
        if case_ids:
            where.append(CounselingSession.counseling_case_id.in_(case_ids))
        if schedule_ids:
            where.append(CounselingSession.schedule_id.in_(schedule_ids))
        if status:
            where.append(CounselingSession.status == status)
        if session_number_min is not None:
            where.append(CounselingSession.session_number >= session_number_min)
        if session_number_max is not None:
            where.append(CounselingSession.session_number <= session_number_max)
        if completed_from:
            where.append(cast(CounselingSession.completed_at, SQLDate) >= completed_from)
        if completed_to:
            where.append(cast(CounselingSession.completed_at, SQLDate) <= completed_to)
        col, descending = resolve_sort(sort, event_columns={"completed": "completed_at"})
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_in_center(
        self,
        session_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingSession:
        session = await self.find_in_center(
            session_id=session_id,
            center_id=center_id,
        )
        if session is None:
            raise EntityNotFoundException(f"CounselingSession not found: {session_id}")
        return session

    @typecheck
    async def find_by_schedule(
        self,
        schedule_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingSession | None:
        stmt = select(CounselingSession).where(
            CounselingSession.schedule_id == schedule_id,
            CounselingSession.center_id == center_id,
            CounselingSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    @typecheck
    async def list_by_case_and_status(
        self,
        case_id: uuid_str,
        status: str,
    ) -> list[CounselingSession]:
        stmt = (
            select(CounselingSession)
            .where(
                CounselingSession.counseling_case_id == case_id,
                CounselingSession.status == status,
                CounselingSession.deleted_at.is_(None),
            )
            .order_by(CounselingSession.created_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_schedule_ids(self, schedule_ids: list[str]) -> list[CounselingSession]:
        if not schedule_ids:
            return []

        stmt = (
            select(CounselingSession)
            .where(
                CounselingSession.schedule_id.in_(schedule_ids),
                CounselingSession.deleted_at.is_(None),
            )
            .order_by(CounselingSession.created_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def count_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
    ) -> int:
        n = await self._session.scalar(
            select(func.count()).where(
                CounselingSession.counseling_case_id == case_id,
                CounselingSession.center_id == center_id,
                CounselingSession.deleted_at.is_(None),
            )
        )
        return n or 0

    @typecheck
    async def count_open_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
    ) -> int:
        # 취소 회기는 소진되지 않으므로 총회기(계약) 자동 확장·하한 기준에서 제외
        n = await self._session.scalar(
            select(func.count()).where(
                CounselingSession.counseling_case_id == case_id,
                CounselingSession.center_id == center_id,
                CounselingSession.status != "cancelled",
                CounselingSession.deleted_at.is_(None),
            )
        )
        return n or 0

    @typecheck
    async def aggregate_completed_by_case_ids(
        self,
        case_ids: list[str],
    ) -> tuple[int, datetime | None]:
        if not case_ids:
            return 0, None

        stmt = select(
            func.count().label("cnt"),
            func.max(CounselingSession.completed_at).label("last_date"),
        ).where(
            CounselingSession.counseling_case_id.in_(case_ids),
            CounselingSession.status == CounselingSessionStatus.COMPLETED,
            CounselingSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        row = result.one()
        return row.cnt or 0, row.last_date

    @typecheck
    async def list_case_ids_by_schedule_ids(self, schedule_ids: list[str]) -> list[str]:
        if not schedule_ids:
            return []

        stmt = (
            select(CounselingSession.counseling_case_id)
            .where(
                CounselingSession.schedule_id.in_(schedule_ids),
                CounselingSession.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def aggregate_active_case_map_by_schedule_ids(
        self,
        schedule_ids: list[str],
    ) -> dict[str, str]:
        if not schedule_ids:
            return {}

        stmt = select(
            CounselingSession.schedule_id,
            CounselingSession.counseling_case_id,
        ).where(
            CounselingSession.schedule_id.in_(schedule_ids),
            CounselingSession.status != CounselingSessionStatus.CANCELLED,
            CounselingSession.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return {row.schedule_id: row.counseling_case_id for row in result.all()}

    @typecheck
    async def list_by_case_ids(self, case_ids: list[str]) -> list[CounselingSession]:
        if not case_ids:
            return []

        stmt = (
            select(CounselingSession)
            .where(
                CounselingSession.counseling_case_id.in_(case_ids),
                CounselingSession.deleted_at.is_(None),
            )
            .order_by(CounselingSession.created_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_ids_in_center(
        self,
        session_ids: list[str],
        center_id: uuid_str,
    ) -> list[CounselingSession]:
        if not session_ids:
            return []

        return await self._filter(
            where=[
                CounselingSession.id.in_(session_ids),
                CounselingSession.center_id == center_id,
            ]
        )

    @typecheck
    async def list_completed_by_case_ids(self, case_ids: list[str]) -> list[CounselingSession]:
        if not case_ids:
            return []
        return await self._filter(
            where=[
                CounselingSession.counseling_case_id.in_(case_ids),
                CounselingSession.status == CounselingSessionStatus.COMPLETED,
            ]
        )

    @typecheck
    async def list_by_schedule_ids_and_case_ids(
        self,
        case_ids: list[str],
        schedule_ids: list[str],
    ) -> list[CounselingSession]:
        if not case_ids or not schedule_ids:
            return []
        return await self._filter(
            where=[
                CounselingSession.counseling_case_id.in_(case_ids),
                CounselingSession.schedule_id.in_(schedule_ids),
                CounselingSession.status.in_(("scheduled", "completed")),
            ]
        )
