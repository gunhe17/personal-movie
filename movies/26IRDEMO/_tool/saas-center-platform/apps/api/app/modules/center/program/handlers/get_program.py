from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.program_facade import ProgramFacade
from ..schemas import ProgramResponse


async def get_program_handler(
    center_id: str,
    program_id: str,
    uow: UnitOfWork,
) -> ProgramResponse:
    facade = ProgramFacade(uow)
    result = await facade.get_with_response(center_id, program_id)
    return result


TOOL = {
    "name": "get_program_handler",
    "permission": "read:program",
    "purpose": "센터 프로그램 한 건을 조회한다.",
    "keywords": ["프로그램 조회", "program 상세"],
    "boundaries": "단건 프로그램 조회(읽기). 목록은 list_programs_handler.",
    "output": "프로그램 상세 (ProgramResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "program_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 프로그램",
                "description": "조회할 프로그램의 UUID.",
            },
        },
        "required": ["program_id"],
    },
}
