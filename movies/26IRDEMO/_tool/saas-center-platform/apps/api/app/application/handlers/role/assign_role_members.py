from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.event import emit
from app.modules.role.facade import RoleFacade
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from .schemas import (
    AssignRoleMembersResponse,
    MemberRoleChangeResult,
)
from app.modules.role.role.schemas import RoleCode


async def assign_role_members_handler(
    center_id: str,
    role_code: str,
    member_ids: list[str],
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> AssignRoleMembersResponse:
    role_facade = RoleFacade(uow)
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)

    target_role = await role_facade.find_role_by_center_and_code(
        center_id, role_code
    )
    if not target_role:
        raise EntityNotFoundException(f"Role을 찾을 수 없습니다: {role_code}")

    members_before = await member_facade.get_members_by_ids(member_ids)
    if not members_before:
        raise EntityNotFoundException("변경 대상 멤버를 찾을 수 없습니다.")

    # SQLAlchemy identity map으로 인해 bulk_update 후 ORM 객체의 role_id가 변경되므로
    # 변경 전 role_id를 별도 저장
    member_previous_role_map = {m.id: m.role_id for m in members_before.values()}
    previous_role_ids = list(set(member_previous_role_map.values()))
    previous_roles = await role_facade.get_roles_by_ids(previous_role_ids)

    # ADMIN 보호: 대상 역할이 ADMIN이거나, 변경 대상에 ADMIN 보유자가 있으면 차단
    if target_role.code == RoleCode.ADMIN.value:
        raise InvalidOperationException(
            "관리자 역할은 다른 구성원에게 할당할 수 없습니다."
        )
    for prev_role_id in previous_role_ids:
        prev_role = previous_roles.get(prev_role_id)
        if prev_role and prev_role.code == RoleCode.ADMIN.value:
            raise InvalidOperationException("관리자의 역할은 변경할 수 없습니다.")

    atomics, changed = await member_facade.bulk_update_member_role(
        center_id, member_ids, target_role.id
    )
    await emit(
        uow,
        "member_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    person_ids = [m.person_id for m in changed]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    results = []
    for member in changed:
        prev_role_id = member_previous_role_map.get(member.id)
        prev_role = previous_roles.get(prev_role_id) if prev_role_id else None
        person = person_map.get(member.person_id)

        results.append(
            MemberRoleChangeResult(
                member_id=member.id,
                previous_role_code=prev_role.code if prev_role else "Unknown",
                previous_role_name=prev_role.name if prev_role else "Unknown",
                new_role_code=target_role.code,
                new_role_name=target_role.name,
                person_name=person.name if person else "Unknown",
            )
        )

    return AssignRoleMembersResponse(
        changed_count=len(results),
        results=results,
    )


TOOL = {
    "name": "assign_role_members_handler",
    "permission": "write:role",
    "purpose": "여러 멤버의 역할을 한 번에 일괄 변경한다.",
    "keywords": ['bulk change member role', "역할 일괄 변경", "멤버 역할 변경", "권한 일괄 변경", "role 일괄", "직원 역할 바꾸기"],
    "boundaries": "여러 멤버의 '역할'을 일괄 변경. 역할별 멤버 조회는 list_role_members_handler.",
    "output": "일괄 역할 변경 결과 (AssignRoleMembersResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_code": {"type": "string", "title": "역할 코드", "description": "부여할 역할 코드."},
            "member_ids": {"type": "array", "items": {"type": "string", "format": "uuid"},
                           "title": "멤버 목록", "description": "역할을 바꿀 멤버 ID 목록."},
        },
        "required": ["role_code", "member_ids"],
    },
}
