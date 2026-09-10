from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy import update as sql_update

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from app.modules.event.event_atomic.models import EventAtomic
from .models import Event


class EventRepository(PostgresRepository[Event]):
    model = Event

    # #
    # command (producer)

    @typecheck
    async def insert(
        self,
        *,
        event_group_id: uuid_str,
        name: str,
        atomics: list,
        center_id: uuid_str | None = None,
        actor_id: uuid_str | None = None,
        actor_type: str = "member",
        ip_address: str | None = None,
    ) -> None:
        self._session.add(
            Event(
                id=event_group_id,
                name=name,
                center_id=center_id,
                actor_id=actor_id,
                actor_type=actor_type,
                ip_address=ip_address,
                status="pending",
                attempts=[],
                max_attempts=5,
            )
        )

        for seq, a in enumerate(atomics):
            self._session.add(
                EventAtomic(
                    event_id=event_group_id,
                    sequence=seq,
                    actor_id=actor_id,
                    act=a.act(),
                    entity_name=a.act_entity_name(),
                    entity_id=a.act_entity_id(),
                    payload=a.payload(),
                )
            )
        await self._session.flush()

    # #
    # command (consumer)

    @typecheck
    async def claim(self, *, id: uuid_str, lease_seconds: int = 60) -> Event | None:
        # 원자적 단일 소비(멀티 워커 락-프리). lease-aware — pending(+due) 또는 stale claimed 재획득.
        due = (Event.next_attempt_at.is_(None)) | (Event.next_attempt_at <= func.now())
        stale = (Event.status == "claimed") & (
            Event.claimed_at
            < func.now() - func.make_interval(0, 0, 0, 0, 0, 0, lease_seconds)
        )
        stmt = (
            sql_update(Event)
            .where(Event.id == id, ((Event.status == "pending") & due) | stale)
            .values(status="claimed", claimed_at=func.now(), updated_at=func.now())
            .returning(Event)
        )
        return (await self._session.execute(stmt)).scalars().first()

    @typecheck
    async def succeed(self, *, id: uuid_str) -> None:
        await self._session.execute(
            sql_update(Event)
            .where(Event.id == id)
            .values(status="succeeded", succeeded_at=func.now(), updated_at=func.now())
        )

    @typecheck
    async def fail(
        self, *, id: uuid_str, backoff_base: int = 10, backoff_cap: int = 3600
    ) -> None:
        ev = await self._session.get(Event, id)
        if ev is None:
            return
        attempts = [*ev.attempts, {"at": datetime.now(timezone.utc).isoformat()}]
        terminal = len(attempts) >= ev.max_attempts
        delay = min(backoff_cap, backoff_base * (2 ** (len(attempts) - 1)))
        await self._session.execute(
            sql_update(Event)
            .where(Event.id == id)
            .values(
                attempts=attempts,
                status="failed" if terminal else "pending",
                failed_at=func.now() if terminal else None,
                next_attempt_at=None
                if terminal
                else func.now() + func.make_interval(0, 0, 0, 0, 0, 0, delay),
                updated_at=func.now(),
            )
        )

    # #
    # query (consumer)

    @typecheck
    async def load_atomics(self, *, event_id: uuid_str) -> list[EventAtomic]:
        rows = await self._session.scalars(
            select(EventAtomic)
            .where(EventAtomic.event_id == event_id)
            .order_by(EventAtomic.sequence)
        )
        return list(rows)

    @typecheck
    async def claim_stale(
        self, *, lease_seconds: int = 60, limit: int = 100
    ) -> list[str]:
        # sweeper용 — pending(+due) 또는 lease 만료된 claimed (claim과 동일 적격 술어)
        due = (Event.next_attempt_at.is_(None)) | (Event.next_attempt_at <= func.now())
        stale = (Event.status == "claimed") & (
            Event.claimed_at
            < func.now() - func.make_interval(0, 0, 0, 0, 0, 0, lease_seconds)
        )
        rows = await self._session.scalars(
            select(Event.id)
            .where(
                Event.deleted_at.is_(None), ((Event.status == "pending") & due) | stale
            )
            .limit(limit)
        )
        return list(rows)
