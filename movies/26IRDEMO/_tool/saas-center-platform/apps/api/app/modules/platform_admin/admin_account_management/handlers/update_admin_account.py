from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account_management.repository import AdminAccountManagementRepository
from app.modules.platform_admin.admin_account_management.schemas import (
    UpdateAdminAccountRoleRequest,
    AdminAccountDetail,
)
from app.modules.platform_admin.admin_account_management.services.update_role import UpdateRoleService


async def update_admin_account_handler(
    *,
    account_id: str,
    data: UpdateAdminAccountRoleRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminAccountDetail:
    repo = uow.repo(AdminAccountManagementRepository)
    service = UpdateRoleService(repo)
    atomic, account = await service.execute(
        account_id=account_id,
        actor_id=actor_id,
        role=data.role,
    )
    response = AdminAccountDetail.model_validate(account)

    await emit(
        uow,
        "admin_account_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": 'update_admin_account_handler',
    "permission": None,
    "purpose": '운영자 계정의 역할 등을 수정한다.',
    "keywords": ['어드민 계정 수정', '관리자 역할 변경', 'admin account 수정'],
    "boundaries": '운영자 전용 — 어드민 계정 역할 수정. 조회는 get_admin_account_handler.',
    "output": '수정된 어드민 계정 상세 (AdminAccountDetail).',
    "input_schema": {
        "type": "object",
        "properties": {
            'account_id': {'type': 'string', 'format': 'uuid', 'title': '대상 어드민 계정', 'description': '수정할 어드민 계정의 UUID.'},
            'role': {'title': '역할', 'type': 'string', 'description': '변경할 운영자 역할.'},
        },
        "required": ['account_id', 'role'],
    },
}
