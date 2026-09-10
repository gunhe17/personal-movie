from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.center.schemas import (
    AdminCenterActionResponse,
    CenterSuspendRequest,
)


async def suspend_center_handler(
    *,
    center_id: str,
    data: CenterSuspendRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminCenterActionResponse:
    center_atomic, center = await CenterFacade(uow).suspend(center_id)

    await emit(
        uow,
        "center_suspended",
        event_group_id=event_group_id,
        atomics=[
            center_atomic,
            AdminAuditAtomic(
                _act="suspended",
                _entity_name="center",
                _entity_id=center_id,
                _payload={
                    "data": {
                        "reason": data.reason,
                        "suspended_until": data.suspended_until,
                    }
                },
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
        message="센터가 정지되었습니다.",
    )


TOOL = {
    "name": "suspend_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 센터를 일시 정지한다.",
    "keywords": [
        "suspend center",
        "센터 정지",
        "센터 일시중지",
        "운영 중단",
        "센터 비활성화",
        "suspend",
    ],
    "boundaries": "운영자 전용 — 센터를 '일시 정지'한다(복구 가능). 영구 종료는 terminate_center_handler, 되돌리기는 restore_center_handler.",
    "output": "센터 정지 결과 (AdminCenterActionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "일시 정지할 센터의 UUID.",
            },
            "reason": {
                "title": "정지 사유",
                "type": "string",
                "description": "일시 정지 사유.",
            },
            "suspended_until": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "정지 해제일",
                "description": "정지 해제 예정일(선택, 없으면 무기한).",
            },
        },
        "required": ["center_id", "reason"],
    },
}
