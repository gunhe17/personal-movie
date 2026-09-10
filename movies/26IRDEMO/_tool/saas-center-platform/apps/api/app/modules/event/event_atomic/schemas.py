from pydantic import BaseModel

from app.core.type import utc_dt, uuid_str

from ..event.models import Event
from .models import EventAtomic


class AuditAtomic(BaseModel):
    id: uuid_str
    center_id: uuid_str
    act: str
    entity_name: str
    entity_id: uuid_str
    actor_id: uuid_str | None = None
    payload: dict
    created_at: utc_dt

    @classmethod
    def from_model(cls, atomic: EventAtomic, *, center_id: uuid_str) -> "AuditAtomic":
        return cls(
            id=atomic.id,
            center_id=center_id,
            act=atomic.act,
            entity_name=atomic.entity_name,
            entity_id=atomic.entity_id,
            actor_id=atomic.actor_id,
            payload=atomic.payload or {},
            created_at=atomic.created_at,
        )


class AuditEvent(BaseModel):
    id: uuid_str
    name: str
    center_id: uuid_str
    actor_id: uuid_str | None = None
    actor_type: str
    ip_address: str | None = None
    created_at: utc_dt
    atomics: list[AuditAtomic]

    @classmethod
    def from_models(
        cls,
        event: Event,
        *,
        atomics: list[EventAtomic],
    ) -> "AuditEvent":
        return cls(
            id=event.id,
            name=event.name,
            center_id=event.center_id,
            actor_id=event.actor_id,
            actor_type=event.actor_type,
            ip_address=event.ip_address,
            created_at=event.created_at,
            atomics=[
                AuditAtomic.from_model(atomic, center_id=event.center_id)
                for atomic in atomics
            ],
        )
