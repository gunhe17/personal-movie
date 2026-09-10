from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import RoomSummary


async def list_rooms_handler(
    center_id: str,
    skip: int,
    limit: int,
    active_only: bool,
    uow: UnitOfWork,
) -> list[RoomSummary]:
    from app.modules.center.facade import RoomFacade

    facade = RoomFacade(uow)
    result = await facade.list_rooms_with_response(
        center_id=center_id,
        skip=skip,
        limit=limit,
        active_only=active_only,
    )
    return result


TOOL = {
    "name": "list_rooms_handler",
    "permission": "read:room",
    "purpose": "센터 상담실 목록을 조회한다.",
    "keywords": ["룸 목록", "상담실 리스트", "방 목록"],
    "boundaries": "상담실 목록(읽기). 단건은 get_room_handler.",
    "output": "상담실 목록 (RoomSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
            "active_only": {
                "type": "boolean",
                "title": "활성만",
                "description": "활성 상담실만 볼지 여부.",
            },
        },
        "required": ["skip", "limit", "active_only"],
    },
}
