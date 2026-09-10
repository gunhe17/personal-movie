from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AccountFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def lock_member_account_handler(
    *,
    account_id: str,
    reason: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    account_atomic, _ = await AccountFacade(uow).lock_account(account_id)

    await emit(
        uow,
        "account_locked",
        event_group_id=event_group_id,
        atomics=[
            account_atomic,
            AdminAuditAtomic(
                _act="locked",
                _entity_name="account",
                _entity_id=account_id,
                _payload={"data": {"id": account_id, "reason": reason}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="계정이 잠금되었습니다.")


TOOL = {
    "name": "lock_member_account_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 운영자가 특정 센터 계정을 잠가 로그인을 영구 차단한다.",
    "keywords": [
        "lock admin account",
        "계정 잠금",
        "계정 정지",
        "로그인 차단",
        "계정 막기",
        "계정 비활성화",
        "이용 정지",
        "관리자 계정 제재",
        "어드민",
    ],
    "boundaries": "운영자(어드민)가 '센터 계정'을 잠그는 전용 도구다. 세션만 끊는 force_logout_admin_account_handler와 달리 해제 전까지 로그인이 영구 차단되며, 되돌리려면 unlock_member_account_handler를 사용한다. 일반 사용자는 호출할 수 없다.",
    "output": "처리 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 계정",
                "description": "잠글 대상 센터 계정의 고유 식별 번호 (UUID 문자열).",
            },
            "reason": {
                "type": "string",
                "title": "잠금 사유",
                "description": "계정을 잠그는 사유. 감사 로그(audit log)에 그대로 기록된다.",
            },
        },
        "required": ["account_id", "reason"],
    },
}
