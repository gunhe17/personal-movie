from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AccountFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def unlock_member_account_handler(
    *,
    account_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    account_atomic, _ = await AccountFacade(uow).unlock_account(account_id)

    await emit(
        uow,
        "account_unlocked",
        event_group_id=event_group_id,
        atomics=[
            account_atomic,
            AdminAuditAtomic(
                _act="unlocked",
                _entity_name="account",
                _entity_id=account_id,
                _payload={"data": {"id": account_id}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="계정 잠금이 해제되었습니다.")


TOOL = {
    "name": "unlock_member_account_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 운영자가 잠긴 센터 계정의 잠금을 해제해 로그인을 다시 허용한다.",
    "keywords": [
        "unlock admin account",
        "계정 잠금 해제",
        "정지 해제",
        "계정 활성화",
        "잠금 풀기",
        "계정 복구",
        "로그인 허용",
        "제재 해제",
        "어드민",
    ],
    "boundaries": "lock_member_account_handler의 역동작으로, 이미 잠긴 센터 계정만 대상으로 한다. 세션을 끊는 force_logout_admin_account_handler와는 무관하며, 잠금 사유 인자를 받지 않는다. 일반 사용자는 호출할 수 없다.",
    "output": "처리 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 계정",
                "description": "잠금을 해제할 센터 계정의 고유 식별 번호 (UUID 문자열).",
            },
        },
        "required": ["account_id"],
    },
}
