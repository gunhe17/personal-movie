from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.program_member_facade import ProgramMemberFacade
from ..schemas import ProgramMemberListResponse


async def list_program_members_handler(
    center_id: str,
    program_id: str,
    uow: UnitOfWork,
) -> ProgramMemberListResponse:
    facade = ProgramMemberFacade(uow)
    result = await facade.list_with_response(
        center_id=center_id,
        program_id=program_id,
    )
    return result


TOOL = {
    "name": "list_program_members_handler",
    "permission": None,
    "purpose": "프로그램의 담당 멤버 목록을 조회한다.",
    "keywords": ["프로그램 멤버 목록", "담당자 조회"],
    "boundaries": "프로그램 담당 멤버 목록(읽기). 배정은 assign_members_handler.",
    "output": "프로그램 담당 멤버 목록 (ProgramMemberListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "program_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 프로그램",
                "description": "담당 멤버를 조회할 프로그램의 UUID.",
            },
        },
        "required": ["program_id"],
    },
}
