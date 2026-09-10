from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AccountFacade
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def force_logout_admin_account_handler(
    *,
    account_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    account_atomic, _ = await AccountFacade(uow).force_logout(account_id)

    await emit(
        uow,
        "account_force_logged_out",
        event_group_id=event_group_id,
        atomics=[
            account_atomic,
            AdminAuditAtomic(
                _act="force_logged_out",
                _entity_name="account",
                _entity_id=account_id,
                _payload={"data": {"id": account_id}},
            ),
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="강제 로그아웃되었습니다.")


TOOL = {
    "name": "force_logout_admin_account_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 운영자가 특정 센터 계정의 모든 활성 세션을 강제 종료해 즉시 로그아웃시킨다.",
    "keywords": [
        "force logout admin account",
        "강제 로그아웃",
        "세션 종료",
        "세션 끊기",
        "접속 끊기",
        "강제 로그아웃 처리",
        "로그아웃 시키기",
        "세션 만료",
        "어드민",
    ],
    "boundaries": "세션만 만료시킬 뿐 계정을 잠그지(lock) 않는다 — 사용자는 곧바로 다시 로그인할 수 있다. 로그인 자체를 막으려면 lock_admin_account_handler를 사용한다. 일반 사용자는 호출할 수 없다.",
    "output": "처리 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 계정",
                "description": "강제 로그아웃할 센터 계정의 고유 식별 번호 (UUID 문자열).",
            },
        },
        "required": ["account_id"],
    },
}
