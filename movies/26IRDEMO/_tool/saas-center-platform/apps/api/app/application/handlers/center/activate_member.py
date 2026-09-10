from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import MemberFacade
from app.modules.center.member.schemas import MemberResponse


async def activate_member_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> MemberResponse:
    atomic, member = await MemberFacade(uow).activate_member(center_id, member_id)
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
    "name": "activate_member_handler",
    "permission": "write:member",
    "purpose": "비활성 상태의 센터 멤버를 활성화한다.",
    "keywords": ['activate member', "멤버 활성화", "직원 활성화", "구성원 활성화"],
    "boundaries": "멤버를 'active'로 전환한다. 비활성화는 deactivate_member_handler, 멤버 정보 수정은 update_member_with_person_handler.",
    "output": "활성화된 멤버 (MemberResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {"type": "string", "format": "uuid", "title": "대상 멤버", "description": "활성화할 멤버의 UUID."},
        },
        "required": ["member_id"],
    },
}
