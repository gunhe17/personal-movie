from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberFacade
from app.modules.event import emit
from app.modules.role.facade import RoleFacade
from app.modules.role.role.schemas import RoleCode


async def leave_center_handler(
    center_id: str,
    person_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> None:
    member_facade = MemberFacade(uow)
    role_facade = RoleFacade(uow)

    role_id = await member_facade.get_member_role_id_by_person(
        center_id, person_id
    )
    role = await role_facade.find_role_with_version(role_id)
    if role and role.code == RoleCode.ADMIN.value:
        raise InvalidOperationException(
            "센터 소유주는 소속 센터를 탈퇴할 수 없습니다. "
            "센터를 삭제하려면 센터 관리에서 센터 전체를 삭제해주세요."
        )

    atomic, _member = await member_facade.leave_center(person_id=person_id, center_id=center_id)
    await emit(
        uow,
        "member_left",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "leave_center_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "로그인한 사용자가 지정한 센터에서 탈퇴(멤버십 해제)한다.",
    "keywords": ['leave center', "센터 탈퇴", "멤버십 해제", "센터 나가기", "소속 해제", "센터 탈퇴하기"],
    "boundaries": "'본인'이 한 센터에서 나간다. 다른 멤버를 내보내는 것(delete_member)이나 센터 자체 종료(terminate_center_handler)와 다르다.",
    "output": "없음 (센터 탈퇴).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {"type": "string", "format": "uuid", "title": "대상 센터", "description": "본인이 탈퇴할 센터의 UUID."},
        },
        "required": ["center_id"],
    },
}
