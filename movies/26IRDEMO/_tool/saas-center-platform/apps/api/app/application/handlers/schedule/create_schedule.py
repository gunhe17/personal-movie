from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import to_utc_naive
from app.modules.event import emit
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    ScheduleCreate,
    ScheduleResponse,
    ConflictingSchedule,
)
from app.modules.center.facade import RoomFacade
from .enrich_conflict_room_names import enrich_flat_conflict_room_names


async def create_schedule_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: ScheduleCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> ScheduleResponse:
    schedule_facade = ScheduleFacade(uow)
    atomic, schedule = await schedule_facade.create_schedule(
        center_id=center_id,
        schedule_type=data.schedule_type.value,
        start=to_utc_naive(data.start),
        end=to_utc_naive(data.end),
        title=data.title,
        room_id=data.room_id,
        memo=data.memo,
        member_id=data.member_id,
    )
    conflicts = await schedule_facade.list_conflicting_schedules(
        center_id=center_id,
        start=schedule.start,
        end=schedule.end,
        room_id=schedule.room_id,
        member_id=schedule.member_id,
        exclude_id=schedule.id,
    )
    await emit(
        uow,
        "schedule_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    response = ScheduleResponse.model_validate(schedule)
    response.has_conflict = len(conflicts) > 0
    response.conflicting_schedules = [
        ConflictingSchedule.from_schedule(
            c,
            check_room_id=data.room_id,
            check_member_id=data.member_id,
        )
        for c in conflicts
    ]

    # Room 충돌은 차단 않고 conflicting_schedules 로 경고만 반환
    await enrich_flat_conflict_room_names(RoomFacade(uow), response.conflicting_schedules)

    return response


TOOL = {
    "name": 'create_schedule_handler',
    "permission": "write:schedule",
    "purpose": '상담·검사·회의 등 일정을 생성한다.',
    "keywords": ['create schedule', '일정 생성', '스케줄 추가', '예약 생성', '일정 잡기', 'schedule 생성', '회기 등록'],
    "boundaries": "새 일정을 '생성'한다. 수정은 update_schedule_handler, 충돌 사전검증은 validate_recurring_schedules_handler.",
    "output": '생성된 일정 (ScheduleResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'member_id': {'anyOf': [{'maxLength': 36, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '담당자 member_id(선택).', 'title': '담당자'},
            'schedule_type': {'$ref': '#/$defs/ScheduleType', 'description': '일정 유형: assessment/counseling/meeting/block.'},
            'title': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '제목', 'description': '일정 제목(선택).'},
            'room_id': {'anyOf': [{'maxLength': 36, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '상담실', 'description': '상담실 UUID(선택).'},
            'start': {'format': 'date-time', 'title': '시작 시각', 'type': 'string', 'description': '일정 시작 시각.'},
            'end': {'format': 'date-time', 'title': '종료 시각', 'type': 'string', 'description': '일정 종료 시각.'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(선택).'},
        },
        "$defs": {'ScheduleType': {'enum': ['assessment', 'counseling', 'meeting', 'block'], 'title': 'ScheduleType', 'type': 'string'}},
        "required": ['schedule_type', 'start', 'end'],
    },
}
