from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.non_operating_time_facade import NonOperatingTimeFacade


async def delete_center_non_operating_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    non_operating_time_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = NonOperatingTimeFacade(uow)
    atomic, _ = await facade.delete(center_id, non_operating_time_id)
    await emit(
        uow,
        "non_operating_time_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_center_non_operating_time_handler",
    "permission": "write:center",
    "purpose": "센터 비운영 시간을 삭제한다.",
    "keywords": ['delete center non operating time', "휴무 삭제", "비운영 시간 제거", "non operating 삭제"],
    "boundaries": "센터 비운영 시간 삭제.",
    "output": "없음 (비운영 시간 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "non_operating_time_id": {"type": "string", "format": "uuid", "title": "대상 비운영 시간", "description": "삭제할 비운영 시간의 UUID."},
        },
        "required": ["non_operating_time_id"],
    },
}
