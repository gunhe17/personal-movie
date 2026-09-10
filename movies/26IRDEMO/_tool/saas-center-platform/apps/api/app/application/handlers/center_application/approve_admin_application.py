# 크로스모듈 조율·감사 emit(center_application_approved)은 공용 app handler가 소유 — admin은 인증·tx 경계만.
from app.modules.platform_admin.center_application.schemas import ApproveApplicationResponse

from app.application.handlers.center_application import (
    approve_center_application_app_handler,
)
from app.infrastructure.persistence.unit_of_work import UnitOfWork


async def approve_admin_application_handler(
    *,
    application_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ApproveApplicationResponse:
    result = await approve_center_application_app_handler(
        application_id=application_id,
        reviewer_account_id=actor_id,
        uow=uow,
        event_group_id=event_group_id,
        ip=ip,
    )

    return ApproveApplicationResponse(message="승인되었습니다", center_id=result.center_id)


TOOL = {
    "name": "approve_admin_application_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터 개설 신청을 운영자가 승인한다.",
    "keywords": ["센터 신청 승인", "개설 승인", "admin application 승인"],
    "boundaries": "운영자 전용 — 센터 개설 신청 '승인'(센터 생성). 반려는 reject_admin_application_handler.",
    "output": "승인 결과 — 생성된 센터 정보 (ApproveApplicationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {'type': 'string', 'format': 'uuid', 'title': '대상 신청', 'description': '승인할 센터 개설 신청의 UUID.'},
        },
        "required": ["application_id"],
    },
}
