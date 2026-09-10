from app.core.type import uuid_str
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import MemberFacade
from app.modules.role.facade import RoleFacade
from app.modules.center.member.schemas import MemberResponse
from app.modules.role.role.schemas import RoleCode


async def deactivate_member_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> MemberResponse:
    member_facade = MemberFacade(uow)

    # verify (센터 소유주 보호)
    role_id = await member_facade.get_member_role_id(member_id, center_id)
    role = await RoleFacade(uow).find_role_with_version(role_id)
    if role and role.code == RoleCode.ADMIN.value:
        raise InvalidOperationException("센터 소유주는 비활성화할 수 없습니다.")

    atomic, member = await member_facade.deactivate_member(center_id, member_id)
    await emit(
        uow,
        "member_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return MemberResponse.model_validate(member)


TOOL = {
    "name": "deactivate_member_handler",
    "permission": "write:member",
    "purpose": "센터 멤버를 비활성화한다.",
    "keywords": ['deactivate member', "멤버 비활성화", "직원 비활성화", "구성원 비활성화", "멤버 상태 변경"],
    "boundaries": "멤버를 'inactive'로 전환한다. 활성화는 activate_member_handler, 삭제는 delete_member_handler. 센터 소유주(ADMIN)는 비활성화 불가.",
    "output": "비활성화된 멤버 (MemberResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {"type": "string", "format": "uuid", "title": "대상 멤버", "description": "비활성화할 멤버의 UUID."},
        },
        "required": ["member_id"],
    },
}
