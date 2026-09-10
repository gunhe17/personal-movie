from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import PermissionSummary
from ..repository import PermissionRepository
from ... import ListPermissionsService


async def list_permissions_handler(
    category: str | None,
    is_new: bool | None,
    uow: UnitOfWork,
) -> list[PermissionSummary]:
    permission_repo = uow.repo(PermissionRepository)
    list_service = ListPermissionsService(permission_repo)
    permissions = await list_service.execute(category=category, is_new=is_new)

    return [PermissionSummary.model_validate(p) for p in permissions]


TOOL = {
    "name": "list_permissions_handler",
    "permission": None,
    "purpose": "권한 목록을 분류·신규여부로 거르고 조회한다.",
    "keywords": ["권한 목록", "퍼미션 조회", "permission 리스트"],
    "boundaries": "권한 목록(읽기 전용) — 권한 항목의 정본은 core 코드.",
    "output": "권한 목록 (PermissionSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "description": "분류 필터(선택).",
            },
            "is_new": {
                "type": "boolean",
                "title": "신규 여부",
                "description": "신규 여부 필터(선택).",
            },
        },
        "required": [],
    },
}
