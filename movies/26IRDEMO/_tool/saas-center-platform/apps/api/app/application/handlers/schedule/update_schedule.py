from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import to_utc_naive
from app.modules.event import emit
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    ScheduleUpdate,
    ScheduleResponse,
    ConflictingSchedule,
)
from app.modules.center.facade import RoomFacade
from .enrich_conflict_room_names import enrich_flat_conflict_room_names


async def update_schedule_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    schedule_id: str,
    data: ScheduleUpdate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> ScheduleResponse:
    # 담당자 변경은 이 Schedule 에만 적용됨(회기 수준). CounselingCase.counselor_id 는
    # 케이스 수준 수정(apply_case_edits_handler)의 책임 — 여기서 건드리지 않는다.
    schedule_facade = ScheduleFacade(uow)
    # 미전달(생략)=유지 / 명시 null=비우기 — model_fields_set으로 구분해 unset 관통
    fields = {k: getattr(data, k) for k in data.model_fields_set}
    for k in ("start", "end"):
        # start/end는 non-nullable 컬럼 — 명시 null은 비우기가 아니라 유지로 강등
        if k in fields:
            if fields[k] is None:
                del fields[k]
            else:
                fields[k] = to_utc_naive(fields[k])
    atomic, schedule = await schedule_facade.update_schedule(
        center_id=center_id,
        schedule_id=schedule_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    conflicts = []
    # 배치 필드가 바뀐 요청만 충돌 경고 (기존 계약 유지)
    if any(fields.get(k) is not None for k in ("member_id", "room_id", "start", "end")):
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
        "schedule_updated",
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
            check_room_id=schedule.room_id,
            check_member_id=schedule.member_id,
        )
        for c in conflicts
    ]

    # Room 충돌은 차단 않고 conflicting_schedules 로 경고만 반환
    await enrich_flat_conflict_room_names(RoomFacade(uow), response.conflicting_schedules)

    return response


TOOL = {
    "name": 'update_schedule_handler',
    "permission": "write:schedule",
    "purpose": '기존 일정을 수정한다.',
    "keywords": ['update schedule', '일정 수정', '스케줄 변경', '예약 변경', '일정 편집'],
    "boundaries": "일정 '수정'. 생성은 create_schedule_handler.",
    "output": '수정된 일정 (ScheduleResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'schedule_id': {'type': 'string', 'format': 'uuid', 'title': '대상 일정', 'description': '수정할 일정의 UUID.'},
            'member_id': {'anyOf': [{'maxLength': 36, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '담당자 member_id(미지정 시 유지).', 'title': '담당자'},
            'title': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '제목', 'description': '일정 제목(미지정 시 유지).'},
            'room_id': {'anyOf': [{'maxLength': 36, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '상담실', 'description': '상담실 UUID(미지정 시 유지).'},
            'start': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시작 시각', 'description': '시작 시각(미지정 시 유지).'},
            'end': {'anyOf': [{'format': 'date-time', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '종료 시각', 'description': '종료 시각(미지정 시 유지).'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '메모', 'description': '메모(미지정 시 유지).'},
        },
        "required": ['schedule_id'],
    },
}
