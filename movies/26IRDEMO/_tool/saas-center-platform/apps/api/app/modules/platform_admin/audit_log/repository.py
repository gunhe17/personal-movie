# 운영자 감사 read-model — event outbox(events×event_atomics)를 직접 읽는 admin 표면(§6.3 허용).
# 구 admin_audit_logs 테이블은 read-only 아카이브로 DB에 존치(코드 바인딩 제거, 판정 2026-07-10).
from sqlalchemy import Text, func, select

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository
from app.modules.event.event.models import Event
from app.modules.event.event_atomic.models import EventAtomic


class AdminAuditReadRepository(PostgresRepository[EventAtomic]):
    model = EventAtomic

    # #
    # query (read-model)

    @typecheck
    async def list_admin_atomics_with_page(
        self,
        *,
        search: str | None = None,
        search_actor_ids: list | None = None,
        target_type: str | None = None,
        admin_account_id: uuid_str | None = None,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list, int]:
        where = [
            Event.actor_type == "admin",
            EventAtomic.deleted_at.is_(None),
        ]
        if search:
            text_match = (
                EventAtomic.entity_name.ilike(f"%{search}%")
                | EventAtomic.act.ilike(f"%{search}%")
                | EventAtomic.payload.cast(Text).ilike(f"%{search}%")
            )
            if search_actor_ids:
                text_match = text_match | Event.actor_id.in_(search_actor_ids)
            where.append(text_match)
        if target_type:
            where.append(EventAtomic.entity_name == target_type)
        if admin_account_id:
            where.append(Event.actor_id == admin_account_id)
        if date_from:
            where.append(EventAtomic.created_at >= date_from)
        if date_to:
            where.append(EventAtomic.created_at <= date_to)

        base = (
            select(EventAtomic, Event)
            .join(Event, Event.id == EventAtomic.event_id)
            .where(*where)
        )
        total = (
            await self._session.execute(
                select(func.count()).select_from(base.subquery())
            )
        ).scalar() or 0
        rows = (
            await self._session.execute(
                base.order_by(EventAtomic.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()
        return list(rows), total

    @typecheck
    async def find_last_admin_atomic(
        self,
        *,
        entity_name: str,
        acts: list,
        entity_id: uuid_str,
    ) -> EventAtomic | None:
        stmt = (
            select(EventAtomic)
            .join(Event, Event.id == EventAtomic.event_id)
            .where(
                Event.actor_type == "admin",
                EventAtomic.entity_name == entity_name,
                EventAtomic.act.in_(acts),
                EventAtomic.entity_id == entity_id,
                EventAtomic.deleted_at.is_(None),
            )
            .order_by(EventAtomic.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalars().first()
