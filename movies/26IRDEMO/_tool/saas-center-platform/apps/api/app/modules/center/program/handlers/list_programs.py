from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.program_facade import ProgramFacade
from ..schemas import ProgramListResponse


async def list_programs_handler(
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ProgramListResponse:
    skip = (page - 1) * size
    facade = ProgramFacade(uow)
    result = await facade.list_with_response(
        center_id=center_id,
        skip=skip,
        limit=size,
        page=page,
        size=size,
    )
    return result


TOOL = {
    "name": "list_programs_handler",
    "permission": None,
    "purpose": "센터 프로그램 목록을 조회한다.",
    "keywords": ["프로그램 목록", "program 리스트"],
    "boundaries": "프로그램 목록(읽기). 단건은 get_program_handler.",
    "output": "프로그램 목록 (ProgramListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["page", "size"],
    },
}
