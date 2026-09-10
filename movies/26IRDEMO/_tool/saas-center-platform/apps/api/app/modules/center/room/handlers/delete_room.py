from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit


async def delete_room_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    room_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    from app.modules.center.facade import RoomFacade

    facade = RoomFacade(uow)
    atomic, _ = await facade.delete_room(
        room_id=room_id,
        center_id=center_id,
    )
    await emit(
        uow,
        "room_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_room_handler",
    "permission": "write:room",
    "purpose": "센터 상담실을 삭제한다.",
    "keywords": ['delete room', "룸 삭제", "상담실 제거", "방 삭제"],
    "boundaries": "상담실 삭제. 조회는 get_room_handler.",
    "output": "없음 (상담실 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "room_id": {"type": "string", "format": "uuid", "title": "대상 상담실", "description": "삭제할 상담실의 UUID."},
        },
        "required": ["room_id"],
    },
}
