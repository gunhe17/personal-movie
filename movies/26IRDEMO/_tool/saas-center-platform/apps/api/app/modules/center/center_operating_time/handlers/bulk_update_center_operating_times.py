from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.operating_time_facade import OperatingTimeFacade
from ..schemas import OperatingTimeBulkCreate, OperatingTimeResponse


async def bulk_update_center_operating_times_handler(
    center_id: str,
    data: OperatingTimeBulkCreate,
    confirm: bool,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> list[OperatingTimeResponse]:
    items = [item.model_dump() for item in data.items]

    facade = OperatingTimeFacade(uow)
    atomic, result = await facade.bulk_update_with_response(center_id, items, confirm)
    await emit(
        uow,
        "center_operating_times_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'bulk_update_center_operating_times_handler',
    "permission": "write:center",
    "purpose": '센터 운영시간을 일괄 설정한다.',
    "keywords": ['bulk update center operating times', '운영시간 설정', '영업시간 일괄', 'operating time 설정'],
    "boundaries": "센터 운영시간 '일괄' 설정. 현황 조회는 get_operating_status_handler, 목록은 list_center_operating_times_handler.",
    "output": '설정된 요일별 운영시간 목록 (OperatingTimeResponse 배열).',
    "input_schema": {
        "type": "object",
        "properties": {
            'confirm': {'type': 'boolean', 'title': '충돌 강제 확정', 'description': '충돌 시 강제 확정 여부.'},
            'items': {'items': {'$ref': '#/$defs/OperatingTimeCreate'}, 'maxItems': 7, 'minItems': 7, 'title': '요일별 운영시간', 'type': 'array', 'description': '월~일 7개 요일의 운영시간(개점·마감·휴게) 설정. 정확히 7건.'},
        },
        "$defs": {'OperatingTimeCreate': {'properties': {'weekday': {'$ref': '#/$defs/Weekday'}, 'open_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Open Time'}, 'close_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Close Time'}, 'break_start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Break Start Time'}, 'break_end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Break End Time'}}, 'required': ['weekday'], 'title': 'OperatingTimeCreate', 'type': 'object'}, 'Weekday': {'enum': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 'title': 'Weekday', 'type': 'string'}},
        "required": ['confirm', 'items'],
    },
}
