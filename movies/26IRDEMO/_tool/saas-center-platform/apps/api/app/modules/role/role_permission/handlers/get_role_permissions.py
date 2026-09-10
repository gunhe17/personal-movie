from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from ..schemas import RolePermissionsResponse
from ...facade import RoleFacade


async def get_role_permissions_handler(
    center_id: str,
    role_code: str,
    uow: UnitOfWork,
) -> RolePermissionsResponse:
    # role_code → role_id 변환은 facade 내부에서 수행.
    facade = RoleFacade(uow)
    role = await facade.find_role_by_center_and_code(center_id, role_code)
    if not role:
        raise EntityNotFoundException(f"Role not found: {role_code}")
    result = await facade.get_role_with_permissions_with_response(role.id)
    return result


TOOL = {
    "name": "get_role_permissions_handler",
    "permission": "read:role",
    "purpose": "역할에 배정된 권한 목록을 조회한다.",
    "keywords": ["역할 권한 조회", "권한 목록", "role permission 조회"],
    "boundaries": "한 역할의 권한 목록(읽기). 배정은 assign_role_permissions_handler.",
    "output": "역할의 권한 목록 (RolePermissionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "description": "권한을 조회할 역할 코드.",
            },
        },
        "required": ["role_code"],
    },
}
