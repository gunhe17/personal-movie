from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.center.schemas import AdminCenterActionResponse


async def activate_center_handler(
    *,
    center_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminCenterActionResponse:
    center_atomic, center = await CenterFacade(uow).activate(center_id)

    await emit(
        uow,
        "center_activated",
        event_group_id=event_group_id,
        atomics=[
            center_atomic,
            AdminAuditAtomic(
                _act="activated",
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
        message="센터가 활성화되었습니다.",
    )


TOOL = {
    "name": "activate_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 운영자가 정지·비활성 상태의 센터를 다시 활성화해 정상 운영 상태로 되돌린다.",
    "keywords": [
        "activate center",
        "센터 활성화",
        "센터 다시 켜기",
        "정지 해제",
        "운영 재개",
        "센터 살리기",
        "비활성 해제",
        "센터 복구",
        "어드민",
    ],
    "boundaries": "운영자(어드민) 전용 도구로, 센터를 '활성(is_active=true)'으로 전환한다. 반대로 센터를 멈추려면 suspend_center_handler를, 해지를 되돌리려면 restore_center_handler를 쓴다. suspend의 짝(정지 해제)이고, 데이터 보관 후 완전 해지하는 terminate_center_handler와는 다르다. 일반 센터 사용자는 호출할 수 없다.",
    "output": "센터 활성화 결과 (AdminCenterActionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "활성화할 센터(지점)의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
