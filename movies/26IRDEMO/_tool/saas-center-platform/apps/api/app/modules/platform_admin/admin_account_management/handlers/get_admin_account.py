from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
)
from app.modules.platform_admin.admin_account_management.schemas import (
    AdminAccountDetail,
)


async def get_admin_account_handler(
    account_id: str,
    uow: UnitOfWork,
) -> AdminAccountDetail:
    repo = uow.repo(AdminAccountManagementRepository)
    account = await repo.get_by_id(account_id)

    return AdminAccountDetail.model_validate(account)


TOOL = {
    "name": "get_admin_account_handler",
    "permission": None,
    "purpose": "운영자 계정 관리 상세를 조회한다.",
    "keywords": ["어드민 계정 관리", "관리자 상세 조회", "admin 계정 관리"],
    "boundaries": "운영자 전용 — 어드민 계정 '관리' 상세(역할 등 포함, 읽기). 수정은 update_admin_account_handler.",
    "output": "어드민 계정 관리 상세 (AdminAccountDetail).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 어드민 계정",
                "description": "조회할 어드민 계정의 UUID.",
            },
        },
        "required": ["account_id"],
    },
}
