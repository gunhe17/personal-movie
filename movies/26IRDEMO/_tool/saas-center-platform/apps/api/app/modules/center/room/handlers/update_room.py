from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import RoomUpdate, RoomResponse


async def update_room_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    room_id: str,
    data: RoomUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> RoomResponse:
    from app.modules.center.facade import RoomFacade

    facade = RoomFacade(uow)
    atomic, room = await facade.update_room(
        room_id=room_id,
        center_id=center_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **data.model_dump(exclude_unset=True),
    )
    await emit(
        uow,
        "room_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return RoomResponse.model_validate(room)


TOOL = {
    "name": "update_room_handler",
    "permission": "write:room",
    "purpose": "센터 상담실 정보를 수정한다.",
    "keywords": ["update room", "룸 수정", "상담실 변경", "방 편집"],
    "boundaries": "상담실 수정. 생성은 create_room_handler.",
    "output": "수정된 상담실 (RoomResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "room_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 상담실",
                "description": "수정할 상담실의 UUID.",
            },
            "name": {
                "anyOf": [
                    {"maxLength": 100, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "상담실명",
                "description": "상담실 이름(미지정 시 유지).",
            },
            "description": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "설명",
                "description": "상담실 설명(미지정 시 유지).",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "메모(미지정 시 유지).",
            },
            "thumbnail_url": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "썸네일 URL",
                "description": "대표 이미지 URL(미지정 시 유지).",
            },
            "is_active": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "title": "활성 여부",
                "description": "사용 활성 여부(미지정 시 유지).",
            },
            "inactive_reason": {
                "anyOf": [{"maxLength": 200, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "비활성 사유",
                "description": "비활성화 시 사유(미지정 시 유지).",
            },
        },
        "required": ["room_id"],
    },
}
