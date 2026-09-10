from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.member_non_working_time_facade import MemberNonWorkingTimeFacade
from ..schemas import MemberNonWorkingTimeCreate, MemberNonWorkingTimeResponse


async def create_member_non_working_time_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    data: MemberNonWorkingTimeCreate,
    confirm: bool,
    uow: UnitOfWork,
    actor_id: str,
) -> MemberNonWorkingTimeResponse:
    facade = MemberNonWorkingTimeFacade(uow)
    atomic, non_working_time = await facade.create(
        member_id, center_id,
        reason=data.reason.value if data.reason else data.reason,
        year=data.year,
        month=data.month,
        day=data.day,
        month_week=data.month_week,
        weekday=data.weekday.value if data.weekday else None,
        start_time=data.start_time.isoformat() if data.start_time else None,
        end_time=data.end_time.isoformat() if data.end_time else None,
        effective_from=data.effective_from.isoformat() if data.effective_from else None,
        effective_to=data.effective_to.isoformat() if data.effective_to else None,
        description=data.description,
    )
    await emit(
        uow,
        "member_non_working_time_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return MemberNonWorkingTimeResponse.model_validate(non_working_time)


TOOL = {
    "name": 'create_member_non_working_time_handler',
    "permission": "write:member",
    "purpose": '멤버의 비근무(휴가·부재) 시간을 등록한다.',
    "keywords": ['create member non working time', '휴가 등록', '비근무 시간', '멤버 부재', '연차 등록'],
    "boundaries": "멤버 '비근무' 시간 생성. 근무시간은 member_working_time 쪽.",
    "output": '등록된 멤버 비근무 시간 (MemberNonWorkingTimeResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'member_id': {'type': 'string', 'format': 'uuid', 'title': '대상 멤버', 'description': '대상 멤버의 UUID.'},
            'confirm': {'type': 'boolean', 'title': '충돌 강제 확정', 'description': '충돌 시 강제 확정 여부.'},
            'year': {'anyOf': [{'maximum': 2100, 'minimum': 2020, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '연도', 'description': '특정일 지정 시 연도(반복이면 생략).'},
            'month': {'anyOf': [{'maximum': 12, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '월', 'description': '월(1~12, 선택).'},
            'day': {'anyOf': [{'maximum': 31, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '일', 'description': '일(1~31, 선택).'},
            'month_week': {'anyOf': [{'maximum': 5, 'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '월 주차', 'description': '매월 N째 주(1~5, 선택).'},
            'weekday': {'anyOf': [{'$ref': '#/$defs/Weekday'}, {'type': 'null'}], 'default': None, 'description': '요일(MON~SUN, 반복 지정 시).'},
            'start_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시작 시각', 'description': '비근무 시작 시각(선택, 없으면 종일).'},
            'end_time': {'anyOf': [{'format': 'time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '종료 시각', 'description': '비근무 종료 시각(선택).'},
            'effective_from': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '적용 시작', 'description': '규칙 적용 시작 일시(선택).'},
            'effective_to': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '적용 종료', 'description': '규칙 적용 종료 일시(선택).'},
            'reason': {'$ref': '#/$defs/MemberNonWorkingTimeReason', 'description': '사유: 연차/반차/병가/개인/교육/출장/기타.'},
            'description': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '상세 사유', 'description': '상세 설명(선택).'},
        },
        "$defs": {'MemberNonWorkingTimeReason': {'enum': ['ANNUAL_LEAVE', 'HALF_DAY_AM', 'HALF_DAY_PM', 'SICK_LEAVE', 'PERSONAL', 'TRAINING', 'BUSINESS_TRIP', 'OTHER'], 'title': 'MemberNonWorkingTimeReason', 'type': 'string'}, 'Weekday': {'enum': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 'title': 'Weekday', 'type': 'string'}},
        "required": ['member_id', 'confirm', 'reason'],
    },
}
