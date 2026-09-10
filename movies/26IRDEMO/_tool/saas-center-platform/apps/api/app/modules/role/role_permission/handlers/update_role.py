from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import RolePermissionsResponse
from ...role.schemas import RoleUpdate
from ...facade import RoleFacade


async def update_role_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    role_code: str,
    data: RoleUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> RolePermissionsResponse:
    # unset 관통(D6) — omit/null 판정은 여기 한 곳. name·access_level은 non-nullable이라 명시 null 드롭
    fields = {
        k: getattr(data, k)
        for k in data.model_fields_set
        if k in ("name", "description", "access_level")
    }
    for non_nullable in ("name", "access_level"):
        if fields.get(non_nullable, "") is None:
            fields.pop(non_nullable)

    facade = RoleFacade(uow)
    atomics, role = await facade.update_custom_role(
        center_id=center_id,
        role_code=role_code,
        changed=data.model_dump(mode="json", exclude_unset=True),
        permission_ids=data.permission_ids,
        expected_version=data.expected_version,
        **fields,
    )
    await emit(
        uow,
        "role_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return await facade.get_role_with_permissions_with_response(role.id)


TOOL = {
    "name": "update_role_handler",
    "permission": "write:role",
    "purpose": "센터 역할을 수정한다.",
    "keywords": ["update role", "역할 수정", "role 편집", "권한 그룹 변경"],
    "boundaries": "센터 역할 수정. 생성은 create_role_handler.",
    "output": "수정된 역할과 권한 (RolePermissionsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "description": "수정할 역할 코드.",
            },
            "name": {
                "anyOf": [
                    {"maxLength": 100, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "역할 이름",
                "description": "역할 이름(미지정 시 유지).",
            },
            "description": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "설명",
                "description": "역할 설명(미지정 시 유지).",
            },
            "permission_ids": {
                "description": "역할에 부여할 권한 ID 목록(전체 교체).",
                "items": {"type": "integer"},
                "title": "권한 목록",
                "type": "array",
            },
            "access_level": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "데이터 접근 범위: all/own(미지정 시 유지).",
                "title": "접근 범위",
            },
            "expected_version": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "description": "낙관적 동시성 가드 — 현재 버전(생략 시 미적용).",
                "title": "기대 버전",
            },
        },
        "required": ["role_code", "permission_ids"],
    },
}
