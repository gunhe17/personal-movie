from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account.models import AdminRole
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository


class UpdateRoleService:
    def __init__(self, repo: AdminAccountManagementRepository):
        self.repo = repo

    async def execute(
        self, *, account_id: str, actor_id: str, role: str
    ) -> tuple[AdminAuditAtomic, AdminAccount]:
        if actor_id == account_id:
            raise InvalidOperationException("자기 자신의 역할은 변경할 수 없습니다")

        account = await self.repo.get_by_id(account_id)

        if account.role in AdminRole.SUPER_PLUS:
            raise InvalidOperationException("시스템 관리자 및 슈퍼관리자의 역할은 변경할 수 없습니다")

        account = await self.repo.update_role(id=account_id, role=role)
        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="admin_account",
            _entity_id=account_id,
            _payload={"data": {"id": account_id, "email": account.email, "role": role}},
        )
        return atomic, account
