from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.event import emit
from ..schemas import RolePermissionAssign, RolePermissionsResponse
from ..schemas import AssignRolePermissionsCommand
from ...facade import RoleFacade


async def assign_role_permissions_handler(
    center_id: str,
    role_code: str,
    data: RolePermissionAssign,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> RolePermissionsResponse:
    facade = RoleFacade(uow)
    role = await facade.find_role_by_center_and_code(center_id, role_code)
    if not role:
        raise EntityNotFoundException(f"Role not found: {role_code}")
    command = AssignRolePermissionsCommand(permission_ids=data.permission_ids)
    atomics, role = await facade.assign_permissions(role.id, command)
    await emit(
        uow,
        "role_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    result = await facade.get_role_with_permissions_with_response(role.id)
    return result


TOOL = {
    "name": "assign_role_permissions_handler",
    "permission": "write:role",
    "purpose": "역할에 권한들을 배정한다.",
    "keywords": [
        "assign role permissions",
        "권한 배정",
        "역할 권한 설정",
        "assign permission",
    ],
    "boundaries": "역할에 권한을 '배정'. 역할 권한 조회는 get_role_permissions_handler.",
    "output": "배정 후 역할의 권한 목록 (RolePermissionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "description": "권한을 배정할 역할 코드.",
            },
            "permission_ids": {
                "description": "역할에 배정할 권한 ID 목록(전체 교체).",
                "items": {"type": "integer"},
                "title": "권한 목록",
                "type": "array",
            },
        },
        "required": ["role_code", "permission_ids"],
    },
}
