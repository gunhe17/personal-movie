from datetime import date, datetime, time

from sqlalchemy import func, or_, select

from app.core.type import typecheck, utc_dt, uuid_str
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ScheduleChangeRequest


class ScheduleChangeRequestRepository(PostgresRepository[ScheduleChangeRequest]):
    model = ScheduleChangeRequest

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        schedule_id: uuid_str,
        person_id: uuid_str,
        client_id: uuid_str,
        current_start: utc_dt,
        current_end: utc_dt,
        requested_start: utc_dt,
        requested_end: utc_dt,
        reason: str | None = None,
    ) -> ScheduleChangeRequest:
        return await super().add(
            ScheduleChangeRequest(
                center_id=center_id,
                schedule_id=schedule_id,
                person_id=person_id,
                client_id=client_id,
                current_start=current_start,
                current_end=current_end,
                requested_start=requested_start,
                requested_end=requested_end,
                reason=reason,
                status="pending",
            )
        )

    @typecheck
    async def decide(
        self,
        id: uuid_str,
        status: str,
        decided_at: datetime,
        decided_by_member_id: uuid_str | None = None,
        decision_note: str | None = None,
    ) -> ScheduleChangeRequest | None:
        return await self.update_fields(
            id,
            status=status,
            decided_by_member_id=decided_by_member_id,
            decided_at=decided_at,
            decision_note=decision_note,
        )

    # #
    # query

    @typecheck
    async def find_pending_by_schedule(self, schedule_id: uuid_str) -> ScheduleChangeRequest | None:
        return await self._find(
            where=[
                self.model.schedule_id == schedule_id,
                self.model.status == "pending",
            ]
        )

    @typecheck
    async def list_pending_by_schedule_ids(self, schedule_ids: list[str]) -> list[ScheduleChangeRequest]:
        if not schedule_ids:
            return []
        return await self._filter(
            where=[
                self.model.schedule_id.in_(schedule_ids),
                self.model.status == "pending",
            ]
        )

    @typecheck
    async def list_by_center(
        self,
        center_id: uuid_str,
        status: str | None = None,
    ) -> list[ScheduleChangeRequest]:
        where = [self.model.center_id == center_id]
        if status:
            where.append(self.model.status == status)
        return await self._filter(where=where, order_by="created_at", descending=True)

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        status: str | None = None,
        schedule_id: str | None = None,
        schedule_ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        requested_start_from: date | None = None,
        requested_start_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        keyword: str | None = None,
    ) -> list:
        where = [
            self.model.center_id == center_id,
            self.model.deleted_at.is_(None),
        ]
        if ids:
            where.append(self.model.id.in_(ids))
        if status:
            where.append(self.model.status == status)
        sid_set = set(schedule_ids or [])
        if schedule_id:
            sid_set.add(schedule_id)
        if sid_set:
            where.append(self.model.schedule_id.in_(sid_set))
        cid_set = set(client_ids or [])
        if client_id:
            cid_set.add(client_id)
        if cid_set:
            where.append(self.model.client_id.in_(cid_set))
        if requested_start_from:
            where.append(self.model.requested_start >= datetime.combine(requested_start_from, time.min))
        if requested_start_to:
            where.append(self.model.requested_start <= datetime.combine(requested_start_to, time.max))
        if date_from:
            where.append(self.model.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(self.model.created_at <= datetime.combine(date_to, time.max))
        if keyword:
            where.append(
                or_(
                    self.model.reason.ilike(f"%{keyword}%"),
                    self.model.decision_note.ilike(f"%{keyword}%"),
                )
            )
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        status: str | None = None,
        schedule_id: str | None = None,
        schedule_ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        requested_start_from: date | None = None,
        requested_start_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        keyword: str | None = None,
    ) -> list[ScheduleChangeRequest]:
        where = self._agent_where(
            center_id,
            ids=ids,
            status=status,
            schedule_id=schedule_id,
            schedule_ids=schedule_ids,
            client_id=client_id,
            client_ids=client_ids,
            requested_start_from=requested_start_from,
            requested_start_to=requested_start_to,
            date_from=date_from,
            date_to=date_to,
            keyword=keyword,
        )
        col, descending = resolve_sort(
            sort,
            time_col="requested_start",
            default_col="requested_start",
            event_columns={"requested_start": "requested_start"},
        )
        order_col = getattr(self.model, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(self.model).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        status: str | None = None,
        schedule_id: str | None = None,
        schedule_ids: list[str] | None = None,
        client_id: str | None = None,
        client_ids: list[str] | None = None,
        requested_start_from: date | None = None,
        requested_start_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        keyword: str | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            status=status,
            schedule_id=schedule_id,
            schedule_ids=schedule_ids,
            client_id=client_id,
            client_ids=client_ids,
            requested_start_from=requested_start_from,
            requested_start_to=requested_start_to,
            date_from=date_from,
            date_to=date_to,
            keyword=keyword,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(self.model).where(*where)
        )
        return count or 0
