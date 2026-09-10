from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.role.facade import RoleFacade
from app.modules.center.facade import MemberFacade
from app.modules.role.role_permission.config import DEFAULT_ROLE_PERMISSIONS
from .schemas import RoleSummaryWithCount

PRESET_ROLE_CODES = set(DEFAULT_ROLE_PERMISSIONS.keys())


async def list_center_roles_handler(
    center_id: str,
    uow: UnitOfWork,
) -> list[RoleSummaryWithCount]:
    role_facade = RoleFacade(uow)
    member_facade = MemberFacade(uow)

    roles = await role_facade.list_roles_by_center(center_id)
    member_counts = await member_facade.count_members_by_roles(center_id)

    return [
        RoleSummaryWithCount(
            id=r.id,
            code=r.code,
            name=r.name,
            is_preset=r.code in PRESET_ROLE_CODES,
            member_count=member_counts.get(r.id, 0),
            access_level=r.access_level,
        )
        for r in roles
    ]


TOOL = {
    "name": "list_center_roles_handler",
    "permission": "read:role",
    "purpose": "센터의 역할 목록을 각 역할의 멤버 수와 함께 조회한다.",
    "keywords": [
        "list center roles",
        "역할 목록",
        "role 목록",
        "권한 역할 조회",
        "센터 역할 리스트",
    ],
    "boundaries": "센터 역할 목록(멤버 수 포함, 읽기 전용). 특정 역할의 멤버는 list_role_members_handler.",
    "output": "역할 목록, 각 역할 멤버 수 포함 (RoleSummaryWithCount 배열).",
    "input_schema": {"type": "object", "properties": {}, "required": []},
}
