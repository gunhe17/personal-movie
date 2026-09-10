from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.non_operating_time_facade import NonOperatingTimeFacade
from ..schemas import NonOperatingTimeCreate, NonOperatingTimeResponse


async def create_center_non_operating_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: NonOperatingTimeCreate,
    confirm: bool,
    uow: UnitOfWork,
    actor_id: str,
    account_id: str,
) -> NonOperatingTimeResponse:
    facade = NonOperatingTimeFacade(uow)
    atomic, non_op = await facade.create(
        center_id=center_id,
        year=data.year,
        month=data.month,
        day=data.day,
        month_week=data.month_week,
        weekday=data.weekday.value if data.weekday else None,
        start_time=data.start_time,
        end_time=data.end_time,
        effective_from=data.effective_from,
        effective_to=data.effective_to,
        reason=data.reason,
        confirm=confirm,
        created_by=account_id,
    )
    await emit(
        uow,
        "non_operating_time_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return NonOperatingTimeResponse.model_validate(non_op)


TOOL = {
    "name": 'create_center_non_operating_time_handler',
    "permission": "write:center",
    "purpose": '센터 비운영(휴무) 시간을 등록한다.',
    "keywords": ['create center non operating time', '휴무 등록', '비운영 시간', '센터 휴일', 'non operating 생성'],
    "boundaries": "센터 '비운영' 시간 생성. 공휴일 일괄 등록은 register_center_holidays_handler.",
    "output": '등록된 센터 비운영 시간 (NonOperatingTimeResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'confirm': {'type': 'boolean', 'title': '충돌 강제 확정', 'description': '충돌 시 강제 확정 여부.'},
            'year': {'anyOf': [{'maximum': 2100, 'minimum': 2020, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '연도', 'description': '특정일 지정 시 연도(반복이면 생략).'},
            'month': {'anyOf': [{'maximum': 12, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '월', 'description': '월(1~12, 선택).'},
            'day': {'anyOf': [{'maximum': 31, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '일', 'description': '일(1~31, 선택).'},
            'month_week': {'anyOf': [{'maximum': 5, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '월 주차', 'description': '매월 N째 주(1~5, 선택).'},
            'weekday': {'anyOf': [{'$ref': '#/$defs/Weekday'}, {'type': 'null'}], 'default': None, 'description': '요일(MON~SUN, 반복 지정 시).'},
            'start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시작 시각', 'description': '비운영 시작 시각(선택, 없으면 종일).'},
            'end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '종료 시각', 'description': '비운영 종료 시각(선택).'},
            'effective_from': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '적용 시작', 'description': '규칙 적용 시작 일시(선택).'},
            'effective_to': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '적용 종료', 'description': '규칙 적용 종료 일시(선택).'},
            'reason': {'maxLength': 200, 'minLength': 1, 'title': '사유', 'type': 'string', 'description': '비운영 사유.'},
        },
        "$defs": {'Weekday': {'enum': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 'title': 'Weekday', 'type': 'string'}},
        "required": ['confirm', 'reason'],
    },
}
