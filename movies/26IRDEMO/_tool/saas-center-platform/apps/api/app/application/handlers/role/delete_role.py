from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.event import emit
from app.modules.role.role_permission.config import DEFAULT_ROLE_PERMISSIONS
from app.modules.role.facade import RoleFacade
from app.modules.center.facade import MemberFacade

PRESET_ROLE_CODES = set(DEFAULT_ROLE_PERMISSIONS.keys())


async def delete_role_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    role_code: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    role_facade = RoleFacade(uow)
    member_facade = MemberFacade(uow)

    if role_code in PRESET_ROLE_CODES:
        raise InvalidOperationException(
            f"프리셋 역할({role_code})은 삭제할 수 없습니다."
        )

    role = await role_facade.find_role_by_center_and_code(center_id, role_code)
    if not role:
        raise EntityNotFoundException(f"Role을 찾을 수 없습니다: {role_code}")

    count = await member_facade.count_members_by_role(center_id, role.id)
    if count > 0:
        raise InvalidOperationException(
            f"이 역할에 {count}명의 구성원이 있습니다. "
            "구성원을 다른 역할로 이동한 후 삭제해주세요."
        )

    atomic, _ = await role_facade.delete_custom_role(center_id, role_code)
    await emit(
        uow,
        "role_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_role_handler",
    "permission": "write:role",
    "purpose": "센터의 사용자 정의 역할을 삭제한다.",
    "keywords": [
        "delete role",
        "역할 삭제",
        "role 삭제",
        "권한 역할 제거",
        "역할 없애기",
    ],
    "boundaries": "센터 역할을 삭제한다. 역할 목록은 list_center_roles_handler.",
    "output": "없음 (삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "description": "삭제할 역할의 코드.",
            },
        },
        "required": ["role_code"],
    },
}
