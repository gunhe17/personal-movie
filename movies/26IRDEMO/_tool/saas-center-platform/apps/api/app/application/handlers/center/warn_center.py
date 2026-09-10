from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.center.facade import AdminCenterFacade
from app.modules.platform_admin.center.schemas import (
    AdminCenterActionResponse,
    CenterWarnRequest,
)


async def warn_center_handler(
    *,
    center_id: str,
    data: CenterWarnRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminCenterActionResponse:
    atomic, center = await AdminCenterFacade(uow).warn_center(
        center_id,
        reason=data.reason,
        notify=data.notify,
    )
    response = AdminCenterActionResponse(
        id=center.id,
        name=center.name,
        is_active=center.is_active,
        message="경고가 발송되었습니다.",
    )

    # 알림 발송은 reaction(routes.py "center_warned")이 수행 — tx 밖·재시도 멱등
    await emit(
        uow,
        "center_warned",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": "warn_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터에 경고를 발송한다.",
    "keywords": ["센터 경고", "경고 발송", "warn center", "센터 제재"],
    "boundaries": "운영자 전용 — 센터에 '경고' 발송. 정지/종료는 application의 suspend·terminate_center_handler.",
    "output": "경고 처리 결과 (AdminCenterActionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "경고할 센터의 UUID.",
            },
            "reason": {
                "title": "경고 사유",
                "type": "string",
                "description": "센터에 전달할 경고 사유.",
            },
            "notify": {
                "default": True,
                "title": "알림 발송",
                "type": "boolean",
                "description": "true면 센터 관리자에게 알림 발송(기본값).",
            },
        },
        "required": ["center_id", "reason"],
    },
}
