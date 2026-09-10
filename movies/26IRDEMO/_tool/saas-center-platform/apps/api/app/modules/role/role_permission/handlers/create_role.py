from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import RolePermissionsResponse
from ...role.schemas import RoleCreate
from ...facade import RoleFacade


async def create_role_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: RoleCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> RolePermissionsResponse:
    facade = RoleFacade(uow)
    atomics, role = await facade.create_custom_role(
        center_id=center_id,
        name=data.name,
        description=data.description,
        permission_ids=data.permission_ids,
        access_level=data.access_level,
    )
    await emit(
        uow,
        "role_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return await facade.get_role_with_permissions_with_response(role.id)


TOOL = {
    "name": "create_role_handler",
    "permission": "write:role",
    "purpose": "센터 역할을 생성한다.",
    "keywords": ["create role", "역할 생성", "role 생성", "권한 그룹 추가"],
    "boundaries": "센터 역할 생성. 권한 배정은 assign_role_permissions_handler.",
    "output": "생성된 역할과 권한 (RolePermissionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "maxLength": 100,
                "minLength": 1,
                "title": "역할 이름",
                "type": "string",
                "description": "역할 이름.",
            },
            "description": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "설명",
                "description": "역할 설명(선택).",
            },
            "permission_ids": {
                "description": "역할에 부여할 권한 ID 목록.",
                "items": {"type": "integer"},
                "title": "권한 목록",
                "type": "array",
            },
            "access_level": {
                "default": "own",
                "description": "데이터 접근 범위: all(전체)/own(담당만, 기본 own).",
                "title": "접근 범위",
                "type": "string",
            },
        },
        "required": ["name", "permission_ids"],
    },
}
