from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.member_non_working_time_facade import MemberNonWorkingTimeFacade


async def delete_member_non_working_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    non_working_time_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = MemberNonWorkingTimeFacade(uow)
    atomic, _ = await facade.delete(member_id, non_working_time_id)
    await emit(
        uow,
        "member_non_working_time_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_member_non_working_time_handler",
    "permission": "write:member",
    "purpose": "멤버 비근무 시간을 삭제한다.",
    "keywords": ['delete member non working time', "휴가 삭제", "비근무 시간 제거"],
    "boundaries": "멤버 비근무 시간 삭제.",
    "output": "없음 (비근무 시간 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {"type": "string", "format": "uuid", "title": "대상 멤버", "description": "대상 멤버의 UUID."},
            "non_working_time_id": {"type": "string", "format": "uuid", "title": "대상 비근무 시간", "description": "삭제할 비근무 시간의 UUID."},
        },
        "required": ["member_id", "non_working_time_id"],
    },
}
