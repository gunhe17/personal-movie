from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.center.schemas import AdminCenterActionResponse


async def restore_center_handler(
    *,
    center_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminCenterActionResponse:
    center_atomic, center = await CenterFacade(uow).restore(center_id)

    await emit(
        uow,
        "center_restored",
        event_group_id=event_group_id,
        atomics=[
            center_atomic,
            AdminAuditAtomic(
                _act="restored",
                _entity_name="center",
                _entity_id=center_id,
                _payload={"data": {"id": center_id}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return AdminCenterActionResponse(
        id=center.id,
        name=center.name,
        is_active=center.is_active,
        message="센터 해지가 철회되었습니다.",
    )


TOOL = {
    "name": "restore_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "정지·종료된 센터를 운영자가 복구한다.",
    "keywords": [
        "restore center",
        "센터 복구",
        "센터 활성화",
        "정지 해제",
        "센터 재개",
        "복원",
    ],
    "boundaries": "운영자 전용 — 정지/종료 상태의 센터를 다시 운영 상태로 되돌린다. 정지는 suspend, 종료는 terminate_center_handler.",
    "output": "센터 복구 결과 (AdminCenterActionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "복구할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
