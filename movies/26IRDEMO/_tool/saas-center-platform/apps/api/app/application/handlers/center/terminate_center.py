from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.center.schemas import (
    AdminCenterActionResponse,
    CenterTerminateRequest,
)


async def terminate_center_handler(
    *,
    center_id: str,
    data: CenterTerminateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminCenterActionResponse:
    center_atomic, center = await CenterFacade(uow).terminate(center_id)

    await emit(
        uow,
        "center_terminated",
        event_group_id=event_group_id,
        atomics=[
            center_atomic,
            AdminAuditAtomic(
                _act="terminated",
                _entity_name="center",
                _entity_id=center_id,
                _payload={
                    "data": {"reason": data.reason, "notify_center": data.notify_center}
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
        message="센터가 해지되었습니다. 30일간 데이터가 보관됩니다.",
    )


TOOL = {
    "name": "terminate_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영자가 센터를 영구 종료한다.",
    "keywords": [
        "terminate center",
        "센터 종료",
        "센터 폐쇄",
        "운영 종료",
        "센터 해지",
        "terminate",
    ],
    "boundaries": "운영자 전용 — 센터를 '영구 종료'한다. 일시 정지는 suspend_center_handler(복구 가능), 복구는 restore_center_handler.",
    "output": "센터 영구 종료 결과 (AdminCenterActionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "영구 종료할 센터의 UUID.",
            },
            "reason": {
                "title": "종료 사유",
                "type": "string",
                "description": "영구 종료 사유.",
            },
            "notify_center": {
                "default": True,
                "title": "센터 통지",
                "type": "boolean",
                "description": "센터에 종료를 통지할지 여부(기본 True).",
            },
        },
        "required": ["center_id", "reason"],
    },
}
