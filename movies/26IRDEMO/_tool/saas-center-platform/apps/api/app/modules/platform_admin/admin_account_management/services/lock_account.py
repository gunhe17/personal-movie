from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account.models import AdminRole
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository


class LockAccountService:
    def __init__(self, repo: AdminAccountManagementRepository):
        self.repo = repo

    async def execute(self, account_id: str, actor_id: str) -> tuple[AdminAuditAtomic, AdminAccount]:
        # 잠금 처리 후 엔티티 반환 (audit log용)
        if actor_id == account_id:
            raise InvalidOperationException("자기 자신의 계정을 잠금할 수 없습니다")

        account = await self.repo.get_by_id(account_id)

        if account.role in AdminRole.SUPER_PLUS:
            raise InvalidOperationException("시스템 관리자 및 슈퍼관리자 계정은 잠금할 수 없습니다")

        if not account.is_active:
            raise InvalidOperationException("이미 잠금된 계정입니다")

        account = await self.repo.lock(id=account_id)
        atomic = AdminAuditAtomic(
            _act="locked",
            _entity_name="admin_account",
            _entity_id=account_id,
            _payload={"data": {"id": account_id, "email": account.email}},
        )
        return atomic, account
