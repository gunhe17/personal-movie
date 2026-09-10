from datetime import datetime

from app.core.type import uuid_str
from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import EventAtomicRepository
from ..schemas import AuditEvent


async def query_audit(
    uow: UnitOfWork,
    *,
    center_id: uuid_str,
    entity_names: list[str] | None = None,
    act: str | None = None,
    entity_id: uuid_str | None = None,
    actor_id: uuid_str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[AuditEvent], Page]:
    events, atomics, page_meta = await uow.repo(
        EventAtomicRepository
    ).list_audit_events_in_center_with_page(
        center_id=center_id,
        entity_names=entity_names,
        act=act,
        entity_id=entity_id,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )
    by_event: dict[str, list] = {}
    for atomic in atomics:
        by_event.setdefault(atomic.event_id, []).append(atomic)
    return [
        AuditEvent.from_models(event, atomics=by_event.get(event.id, []))
        for event in events
    ], page_meta
