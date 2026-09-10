# 거절은 단일 owning facade 호출이라 중간 service 없이 admin 핸들러가 직접 호출. 감사는 emit(actor_type='admin') — 별도 감사 테이블 없음.
from app.core.schemas import MessageResponse
from pydantic import BaseModel, Field

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterApplicationFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


class AdminRejectBody(BaseModel):
    reason: str | None = Field(None, max_length=500, description="거절 사유")


async def reject_admin_application_handler(
    *,
    application_id: str,
    body: AdminRejectBody,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    atomic, _ = await CenterApplicationFacade(uow).reject_application(
        application_id=application_id,
        reviewed_reason=body.reason,
        reviewer_account_id=actor_id,
    )

    await emit(
        uow,
        "center_application_rejected",
        event_group_id=event_group_id,
        atomics=[
            atomic,
            AdminAuditAtomic(
                _act="rejected",
                _entity_name="center_application",
                _entity_id=application_id,
                _payload={"reason": body.reason} if body.reason else {},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="거절되었습니다")


TOOL = {
    "name": "reject_admin_application_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터 개설 신청을 운영자가 반려한다.",
    "keywords": ["센터 신청 반려", "개설 거절", "admin application 반려"],
    "boundaries": "운영자 전용 — 신청 '반려'. 승인은 approve_admin_application_handler.",
    "output": "반려 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 신청",
                "description": "반려할 신청의 UUID.",
            },
            "body": {
                "properties": {
                    "reason": {
                        "anyOf": [
                            {"maxLength": 500, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "반려 사유(선택).",
                        "title": "반려 사유",
                    }
                },
                "title": "반려 정보",
                "type": "object",
                "description": "반려 정보 — 사유 등.",
            },
        },
        "required": ["application_id", "body"],
    },
}
