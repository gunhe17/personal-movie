# ai_lab 운영자 행위 기록 — admin 액션은 도메인 마커 없이 AdminAuditAtomic 하나로 통일(promote 선례).
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def emit_admin_audit(
    uow: UnitOfWork,
    group: str,
    *,
    act: str,
    entity_name: str,
    entity_id: uuid_str,
    payload: dict | None = None,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> None:
    await emit(
        uow,
        group,
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act=act,
            _entity_name=entity_name,
            _entity_id=entity_id,
            _payload={"data": payload or {}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
