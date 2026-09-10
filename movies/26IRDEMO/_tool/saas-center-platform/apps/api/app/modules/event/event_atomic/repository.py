from datetime import datetime
from math import ceil

from sqlalchemy import func, select

from app.core.type import typecheck, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from ..event.models import Event
from .models import EventAtomic


class EventAtomicRepository(PostgresRepository[EventAtomic]):
    model = EventAtomic

    # #
    # query

    @typecheck
    async def list_audit_in_center_with_page(
        self,
        center_id: uuid_str,
        entity_names: list[str] | None = None,
        act: str | None = None,
        entity_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[EventAtomic], Page]:
        where = self._audit_where(
            center_id,
            entity_names=entity_names,
            act=act,
            entity_id=entity_id,
            actor_id=actor_id,
            date_from=date_from,
            date_to=date_to,
        )
        rows = await self._session.scalars(
            select(EventAtomic)
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*where)
            .order_by(EventAtomic.created_at.desc())
            .limit(size)
            .offset((page - 1) * size)
        )
        total = await self._session.scalar(
            select(func.count())
            .select_from(EventAtomic)
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*where)
        )
        total = total or 0
        return list(rows), Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    @typecheck
    async def list_audit_events_in_center_with_page(
        self,
        center_id: uuid_str,
        entity_names: list[str] | None = None,
        act: str | None = None,
        entity_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Event], list[EventAtomic], Page]:
        where = self._audit_where(
            center_id,
            entity_names=entity_names,
            act=act,
            entity_id=entity_id,
            actor_id=actor_id,
            date_from=date_from,
            date_to=date_to,
        )

        event_ids_query = (
            select(Event.id)
            .select_from(EventAtomic)
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*where)
            .group_by(Event.id, Event.created_at)
            .order_by(Event.created_at.desc())
            .limit(size)
            .offset((page - 1) * size)
        )
        event_ids = list(await self._session.scalars(event_ids_query))
        total = await self._session.scalar(
            select(func.count(func.distinct(Event.id)))
            .select_from(EventAtomic)
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*where)
        )
        total = total or 0
        events = list(
            await self._session.scalars(
                select(Event)
                .where(Event.id.in_(event_ids))
                .order_by(Event.created_at.desc())
            )
        )
        atomics = list(
            await self._session.scalars(
                select(EventAtomic)
                .where(
                    EventAtomic.event_id.in_(event_ids),
                    EventAtomic.act != "read",
                    EventAtomic.deleted_at.is_(None),
                )
                .order_by(EventAtomic.event_id, EventAtomic.sequence)
            )
        )
        return (
            events,
            atomics,
            Page(
                total=total,
                page=page,
                size=size,
                pages=ceil(total / size) if size else 0,
            ),
        )

    @typecheck
    async def aggregate_act_counts_by_actor(
        self,
        center_id: uuid_str,
        actor_id: uuid_str,
        since: utc_dt,
        *,
        limit: int = 20,
    ) -> list[tuple[str, int]]:
        key = func.concat(EventAtomic.entity_name, ".", EventAtomic.act)
        rows = await self._session.execute(
            select(key.label("key"), func.count().label("n"))
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*self._usage_where(center_id, actor_id, since))
            .group_by(key)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return [(r.key, r.n) for r in rows]

    @typecheck
    async def aggregate_active_hours_by_actor(
        self,
        center_id: uuid_str,
        actor_id: uuid_str,
        since: utc_dt,
    ) -> dict[str, int]:
        hour = func.extract("hour", EventAtomic.created_at)
        rows = await self._session.execute(
            select(hour.label("h"), func.count().label("n"))
            .join(Event, EventAtomic.event_id == Event.id)
            .where(*self._usage_where(center_id, actor_id, since))
            .group_by(hour)
        )
        return {str(int(r.h)): r.n for r in rows}

    @typecheck
    async def aggregate_recent_entities_by_actor(
        self,
        center_id: uuid_str,
        actor_id: uuid_str,
        *,
        limit: int = 3,
    ) -> list[dict]:
        # actor가 최근 만진 엔티티 상위 limit건 — (entity_name, entity_id) distinct, 최신순.
        # 프로필 앵커용: mutation만(act != read), payload는 표시명 추출 재료.
        # agent_* 엔티티 제외 — 에이전트 사용 자체가 상위 슬롯을 채우는 자기 오염 방지.
        latest = func.max(EventAtomic.created_at).label("latest")
        recent = (
            select(
                EventAtomic.entity_name,
                EventAtomic.entity_id,
                latest,
            )
            .join(Event, EventAtomic.event_id == Event.id)
            .where(
                Event.center_id == center_id,
                EventAtomic.actor_id == actor_id,
                EventAtomic.act != "read",
                EventAtomic.entity_name.not_like("agent\\_%"),
                EventAtomic.entity_id.is_not(None),
                EventAtomic.deleted_at.is_(None),
            )
            .group_by(EventAtomic.entity_name, EventAtomic.entity_id)
            .order_by(latest.desc())
            .limit(limit)
            .subquery()
        )
        rows = await self._session.execute(
            select(
                EventAtomic.entity_name,
                EventAtomic.entity_id,
                EventAtomic.payload,
            )
            .join(
                recent,
                (EventAtomic.entity_name == recent.c.entity_name)
                & (EventAtomic.entity_id == recent.c.entity_id)
                & (EventAtomic.created_at == recent.c.latest),
            )
            .order_by(recent.c.latest.desc())
        )
        return [
            {
                "entity_name": r.entity_name,
                "entity_id": r.entity_id,
                "payload": r.payload or {},
            }
            for r in rows
        ]

    # #
    # helpers

    def _audit_where(
        self,
        center_id: str,
        *,
        entity_names: list[str] | None,
        act: str | None,
        entity_id: str | None,
        actor_id: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list:
        where = [
            Event.center_id == center_id,
            EventAtomic.act != "read",
            EventAtomic.deleted_at.is_(None),
        ]
        if entity_names is not None:
            where.append(EventAtomic.entity_name.in_(entity_names))
        if act is not None:
            where.append(EventAtomic.act == act)
        if entity_id is not None:
            where.append(EventAtomic.entity_id == entity_id)
        if actor_id is not None:
            where.append(EventAtomic.actor_id == actor_id)
        if date_from is not None:
            where.append(EventAtomic.created_at >= date_from)
        if date_to is not None:
            where.append(EventAtomic.created_at <= date_to)
        return where

    def _usage_where(self, center_id: str, actor_id: str, since: datetime) -> list:
        return [
            Event.center_id == center_id,
            EventAtomic.actor_id == actor_id,
            EventAtomic.act != "read",
            EventAtomic.created_at >= since,
            EventAtomic.deleted_at.is_(None),
        ]
