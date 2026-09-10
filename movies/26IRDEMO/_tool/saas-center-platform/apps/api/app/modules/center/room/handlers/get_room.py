from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import RoomResponse


async def get_room_handler(
    center_id: str,
    room_id: str,
    uow: UnitOfWork,
) -> RoomResponse:
    from app.modules.center.facade import RoomFacade

    facade = RoomFacade(uow)
    result = await facade.get_room_with_response(
        room_id=room_id,
        center_id=center_id,
    )
    return result


TOOL = {
    "name": "get_room_handler",
    "permission": "read:room",
    "purpose": "센터 상담실 한 건을 조회한다.",
    "keywords": ["룸 조회", "상담실 상세", "방 정보"],
    "boundaries": "단건 상담실 조회(읽기). 목록은 list_rooms_handler.",
    "output": "상담실 상세 (RoomResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "room_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 상담실",
                "description": "조회할 상담실의 UUID.",
            },
        },
        "required": ["room_id"],
    },
}
