from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository


class UnlockAccountService:
    def __init__(self, repo: AdminAccountManagementRepository):
        self.repo = repo

    async def execute(self, account_id: str, actor_id: str) -> tuple[AdminAuditAtomic, AdminAccount]:
        # 잠금 해제 후 엔티티 반환 (audit log용)
        if actor_id == account_id:
            raise InvalidOperationException("자기 자신의 계정 잠금을 해제할 수 없습니다")

        account = await self.repo.get_by_id(account_id)

        if account.is_active:
            raise InvalidOperationException("잠금 상태가 아닌 계정입니다")

        account = await self.repo.unlock(id=account_id)
        atomic = AdminAuditAtomic(
            _act="unlocked",
            _entity_name="admin_account",
            _entity_id=account_id,
            _payload={"data": {"id": account_id, "email": account.email}},
        )
        return atomic, account
