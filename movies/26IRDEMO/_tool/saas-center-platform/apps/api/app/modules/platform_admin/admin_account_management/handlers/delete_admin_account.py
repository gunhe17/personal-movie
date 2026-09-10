from app.core.schemas import MessageResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository
from app.modules.platform_admin.admin_account_management.services.delete_account import DeleteAccountService


async def delete_admin_account_handler(
    *,
    account_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> MessageResponse:
    repo = uow.repo(AdminAccountManagementRepository)
    service = DeleteAccountService(repo)
    atomic, account = await service.execute(account_id, actor_id=actor_id)

    await emit(
        uow,
        "admin_account_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return MessageResponse(message="계정이 해임되었습니다")


TOOL = {
    "name": "delete_admin_account_handler",
    "permission": None,
    "purpose": "운영자 계정을 해임(삭제)한다.",
    "keywords": ["어드민 해임", "관리자 삭제", "admin account 삭제"],
    "boundaries": "운영자 전용 — 어드민 계정 해임. 잠금은 lock_admin_account_handler.",
    "output": "해임 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {'type': 'string', 'format': 'uuid', 'title': '대상 어드민 계정', 'description': '해임할 어드민 계정의 UUID.'},
        },
        "required": ["account_id"],
    },
}
