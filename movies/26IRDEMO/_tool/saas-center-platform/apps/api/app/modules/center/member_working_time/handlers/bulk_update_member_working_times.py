from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.member_working_time_facade import MemberWorkingTimeFacade
from ..schemas import MemberWorkingTimeBulkCreate, MemberWorkingTimeResponse


async def bulk_update_member_working_times_handler(
    center_id: str,
    member_id: str,
    data: MemberWorkingTimeBulkCreate,
    confirm: bool,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> list[MemberWorkingTimeResponse]:
    facade = MemberWorkingTimeFacade(uow)
    atomic, result = await facade.bulk_update_with_response(
        center_id, member_id,
        items=[item.model_dump(mode="json") for item in data.items],
        confirm=confirm,
    )
    await emit(
        uow,
        "member_working_times_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'bulk_update_member_working_times_handler',
    "permission": "write:member",
    "purpose": '멤버의 근무시간을 일괄 설정한다.',
    "keywords": ['bulk update member working times', '근무시간 설정', '멤버 스케줄', 'working time 설정'],
    "boundaries": "멤버 근무시간 '일괄' 설정. 현황은 get_working_status_handler, 비근무는 member_non_working_time 쪽.",
    "output": '설정된 요일별 멤버 근무시간 목록 (MemberWorkingTimeResponse 배열).',
    "input_schema": {
        "type": "object",
        "properties": {
            'member_id': {'type': 'string', 'format': 'uuid', 'title': '대상 멤버', 'description': '대상 멤버의 UUID.'},
            'confirm': {'type': 'boolean', 'title': '충돌 강제 확정', 'description': '충돌 시 강제 확정 여부.'},
            'items': {'items': {'$ref': '#/$defs/MemberWorkingTimeCreate'}, 'maxItems': 7, 'minItems': 7, 'title': '요일별 근무시간', 'type': 'array', 'description': '월~일 7개 요일의 근무시간(시작·종료·휴게) 설정. 정확히 7건.'},
        },
        "$defs": {'MemberWorkingTimeCreate': {'properties': {'weekday': {'$ref': '#/$defs/Weekday'}, 'start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Start Time'}, 'end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'End Time'}, 'break_start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Break Start Time'}, 'break_end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Break End Time'}}, 'required': ['weekday'], 'title': 'MemberWorkingTimeCreate', 'type': 'object'}, 'Weekday': {'enum': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 'title': 'Weekday', 'type': 'string'}},
        "required": ['member_id', 'confirm', 'items'],
    },
}
