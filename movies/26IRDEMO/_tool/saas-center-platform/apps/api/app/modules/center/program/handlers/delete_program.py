from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.program_facade import ProgramFacade


async def delete_program_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    program_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = ProgramFacade(uow)
    atomic, _ = await facade.delete(center_id, program_id)
    await emit(
        uow,
        "program_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_program_handler",
    "permission": "write:program",
    "purpose": "센터 프로그램을 삭제한다.",
    "keywords": ['delete program', "프로그램 삭제", "program 삭제"],
    "boundaries": "프로그램 삭제. 조회는 get_program_handler.",
    "output": "없음 (프로그램 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "program_id": {"type": "string", "format": "uuid", "title": "대상 프로그램", "description": "삭제할 프로그램의 UUID."},
        },
        "required": ["program_id"],
    },
}
