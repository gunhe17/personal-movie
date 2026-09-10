from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.non_operating_time_facade import NonOperatingTimeFacade
from ..schemas import NonOperatingTimeUpdate, NonOperatingTimeResponse


async def update_center_non_operating_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    non_operating_time_id: str,
    data: NonOperatingTimeUpdate,
    confirm: bool,
    uow: UnitOfWork,
    actor_id: str,
) -> NonOperatingTimeResponse:
    update_fields = data.model_dump(exclude_unset=True)

    facade = NonOperatingTimeFacade(uow)
    atomic, updated = await facade.update(
        center_id=center_id,
        non_operating_time_id=non_operating_time_id,
        start_time=update_fields.get("start_time"),
        end_time=update_fields.get("end_time"),
        effective_to=update_fields.get("effective_to"),
        reason=update_fields.get("reason"),
        confirm=confirm,
        changed=data.model_dump(mode="json", exclude_unset=True),
    )
    await emit(
        uow,
        "non_operating_time_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return NonOperatingTimeResponse.model_validate(updated)


TOOL = {
    "name": 'update_center_non_operating_time_handler',
    "permission": "write:center",
    "purpose": '센터 비운영 시간을 수정한다.',
    "keywords": ['update center non operating time', '휴무 수정', '비운영 시간 변경'],
    "boundaries": '비운영 시간 수정. 생성은 create_center_non_operating_time_handler.',
    "output": '수정된 센터 비운영 시간 (NonOperatingTimeResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'non_operating_time_id': {'type': 'string', 'format': 'uuid', 'title': '대상 비운영 시간', 'description': '수정할 비운영 시간의 UUID.'},
            'confirm': {'type': 'boolean', 'title': '충돌 강제 확정', 'description': '충돌 시 강제 확정 여부.'},
            'start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시작 시각', 'description': '비운영 시작 시각(미지정 시 유지).'},
            'end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '종료 시각', 'description': '비운영 종료 시각(미지정 시 유지).'},
            'effective_to': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '적용 종료', 'description': '규칙 적용 종료 일시(미지정 시 유지).'},
            'reason': {'anyOf': [{'maxLength': 200, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사유', 'description': '비운영 사유(미지정 시 유지).'},
        },
        "required": ['non_operating_time_id', 'confirm'],
    },
}
