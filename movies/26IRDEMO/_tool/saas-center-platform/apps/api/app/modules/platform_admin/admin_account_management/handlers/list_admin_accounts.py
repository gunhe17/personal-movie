from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
)
from app.modules.platform_admin.admin_account_management.schemas import (
    AdminAccountSummary,
    AdminAccountListResponse,
)


async def list_admin_accounts_handler(
    uow: UnitOfWork,
    *,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminAccountListResponse:
    repo = uow.repo(AdminAccountManagementRepository)
    accounts, page_meta = await repo.list_accounts_with_page(
        search=search,
        role=role,
        is_active=is_active,
        page=page,
        size=size,
    )
    items = [AdminAccountSummary.model_validate(a) for a in accounts]
    return AdminAccountListResponse.build(
        items=items,
        total=page_meta["total"],
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_admin_accounts_handler",
    "permission": None,
    "purpose": "운영자 계정 목록을 역할·활성으로 거르고 조회한다.",
    "keywords": ["어드민 계정 목록", "관리자 관리 목록", "admin 계정 관리 리스트"],
    "boundaries": "운영자 전용 — 어드민 계정 관리 목록(읽기, 역할 필터). 단건은 get_admin_account_handler.",
    "output": "어드민 계정 목록 (AdminAccountListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role": {
                "type": "string",
                "title": "역할 필터",
                "description": "역할 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "이름·이메일 검색어(선택).",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 여부 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
