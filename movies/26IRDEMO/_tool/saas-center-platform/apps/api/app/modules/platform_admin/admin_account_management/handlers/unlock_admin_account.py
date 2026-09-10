from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository
from app.modules.platform_admin.admin_account_management.services.unlock_account import UnlockAccountService


async def unlock_admin_account_handler(
    *,
    account_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    repo = uow.repo(AdminAccountManagementRepository)
    service = UnlockAccountService(repo)
    atomic, account = await service.execute(account_id, actor_id=actor_id)

    await emit(
        uow,
        "admin_account_unlocked",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="잠금이 해제되었습니다")


TOOL = {
    "name": "unlock_admin_account_handler",
    "permission": None,
    "purpose": "운영자 계정 잠금을 해제한다.",
    "keywords": ["어드민 잠금 해제", "관리자 정지 해제", "admin unlock"],
    "boundaries": "운영자 전용 — 어드민 계정 잠금 해제. 잠금은 lock_admin_account_handler.",
    "output": "잠금 해제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {'type': 'string', 'format': 'uuid', 'title': '대상 어드민 계정', 'description': '잠금 해제할 어드민 계정의 UUID.'},
        },
        "required": ["account_id"],
    },
}
