from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository
from app.modules.platform_admin.admin_account_management.services.lock_account import LockAccountService


async def lock_admin_account_handler(
    *,
    account_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    repo = uow.repo(AdminAccountManagementRepository)
    service = LockAccountService(repo)
    atomic, account = await service.execute(account_id, actor_id=actor_id)

    await emit(
        uow,
        "admin_account_locked",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="계정이 잠금되었습니다")


TOOL = {
    "name": "lock_admin_account_handler",
    "permission": None,
    "purpose": "운영자 계정을 잠근다.",
    "keywords": ["어드민 잠금", "관리자 정지", "admin account 잠금"],
    "boundaries": "운영자 전용 — 어드민 계정 잠금. 해제는 unlock_admin_account_handler, 해임은 delete_admin_account_handler.",
    "output": "잠금 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {'type': 'string', 'format': 'uuid', 'title': '대상 어드민 계정', 'description': '잠글 어드민 계정의 UUID.'},
        },
        "required": ["account_id"],
    },
}
