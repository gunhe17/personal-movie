from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.program_member_facade import ProgramMemberFacade


async def unassign_member_handler(
    center_id: str,
    program_id: str,
    member_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> None:
    facade = ProgramMemberFacade(uow)
    atomic, _pm = await facade.unassign(
        center_id=center_id,
        program_id=program_id,
        member_id=member_id,
    )
    await emit(
        uow,
        "program_member_unassigned",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "unassign_member_handler",
    "permission": "write:program",
    "purpose": "프로그램에서 담당 멤버 배정을 해제한다.",
    "keywords": ['unassign member', "멤버 배정 해제", "담당자 제거", "unassign"],
    "boundaries": "프로그램 담당 멤버 '해제'. 배정은 assign_members_handler.",
    "output": "없음 (멤버 배정 해제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "program_id": {"type": "string", "format": "uuid", "title": "대상 프로그램", "description": "프로그램의 UUID."},
            "member_id": {"type": "string", "format": "uuid", "title": "대상 멤버", "description": "배정 해제할 멤버의 UUID."},
        },
        "required": ["program_id", "member_id"],
    },
}
