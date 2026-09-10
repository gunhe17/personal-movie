from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import RoomCreate, RoomResponse


async def create_room_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: RoomCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> RoomResponse:
    from app.modules.center.facade import RoomFacade

    facade = RoomFacade(uow)
    atomic, room = await facade.create_room(
        center_id=center_id,
        name=data.name,
        description=data.description,
        memo=data.memo,
        thumbnail_url=data.thumbnail_url,
        is_active=data.is_active,
        inactive_reason=data.inactive_reason,
    )
    await emit(
        uow,
        "room_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return RoomResponse.model_validate(room)


TOOL = {
    "name": 'create_room_handler',
    "permission": "write:room",
    "purpose": '센터 상담실(룸)을 생성한다.',
    "keywords": ['create room', '룸 생성', '상담실 추가', '방 만들기', 'room 생성'],
    "boundaries": '상담실 생성. 수정은 update_room_handler, 예약 가능 확인은 center/get_room_slot_status_handler.',
    "output": '생성된 상담실 (RoomResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'maxLength': 100, 'minLength': 1, 'title': '상담실명', 'type': 'string', 'description': '상담실 이름.'},
            'description': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '상담실 설명(선택).'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(선택).'},
            'thumbnail_url': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '썸네일 URL', 'description': '대표 이미지 URL(선택).'},
            'is_active': {'default': True, 'title': '활성 여부', 'type': 'boolean', 'description': '사용 활성 여부(기본 True).'},
            'inactive_reason': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '비활성 사유', 'description': '비활성화 시 사유(선택).'},
        },
        "required": ['name'],
    },
}
