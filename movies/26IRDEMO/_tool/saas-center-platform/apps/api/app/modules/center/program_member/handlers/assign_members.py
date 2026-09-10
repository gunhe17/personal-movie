from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.program_member_facade import ProgramMemberFacade
from ..schemas import ProgramMemberAssign, ProgramMemberListResponse


async def assign_members_handler(
    center_id: str,
    program_id: str,
    data: ProgramMemberAssign,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> ProgramMemberListResponse:
    facade = ProgramMemberFacade(uow)
    atomics, result = await facade.assign_with_response(
        center_id=center_id,
        program_id=program_id,
        member_ids=data.member_ids,
    )
    await emit(
        uow,
        "program_member_assigned",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'assign_members_handler',
    "permission": "write:program",
    "purpose": '프로그램에 담당 멤버를 배정한다.',
    "keywords": ['assign members', '프로그램 멤버 배정', '담당자 지정', '멤버 할당'],
    "boundaries": "프로그램에 담당 멤버를 '배정'. 해제는 unassign_member_handler, 목록은 list_program_members_handler.",
    "output": '배정 후 담당 멤버 목록 (ProgramMemberListResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'program_id': {'type': 'string', 'format': 'uuid', 'title': '대상 프로그램', 'description': '멤버를 배정할 프로그램의 UUID.'},
            'member_ids': {'description': '프로그램에 배정할 멤버 UUID 목록(최소 1명).', 'items': {'type': 'string'}, 'minItems': 1, 'title': '배정 멤버 목록', 'type': 'array'},
        },
        "required": ['program_id', 'member_ids'],
    },
}
