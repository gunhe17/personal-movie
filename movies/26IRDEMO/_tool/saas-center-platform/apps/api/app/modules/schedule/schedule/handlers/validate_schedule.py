from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import to_utc_naive
from ..schemas import (
    SingleScheduleValidation,
    SingleScheduleValidationResponse,
    ConflictingSchedule,
)
from ...facade import ScheduleFacade


async def validate_schedule_handler(
    center_id: str,
    data: SingleScheduleValidation,
    uow: UnitOfWork,
) -> SingleScheduleValidationResponse:
    facade = ScheduleFacade(uow)
    conflicts = await facade.validate_schedule(
        center_id=center_id,
        room_id=data.room_id,
        start=to_utc_naive(data.start),
        end=to_utc_naive(data.end),
        member_id=data.member_id,
    )

    conflicting_schedules = [
        ConflictingSchedule.from_schedule(
            c,
            check_room_id=data.room_id,
            check_member_id=data.member_id,
        )
        for c in conflicts
    ]
    return SingleScheduleValidationResponse(
        has_conflicts=len(conflicts) > 0,
        conflicting_schedules=conflicting_schedules,
    )


TOOL = {
    "name": "validate_schedule_handler",
    "permission": "read:schedule",
    "purpose": "단일 일정의 충돌·유효성을 검증한다.",
    "keywords": ["일정 검증", "충돌 확인", "단일 일정 검증", "validate schedule"],
    "boundaries": "한 일정의 충돌/유효성 '사전 검증'. 일괄 검증은 validate_recurring_schedules_handler.",
    "output": "단일 검증 결과 (SingleScheduleValidationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "room_id": {
                "description": "검증할 상담실(장소)의 UUID.",
                "title": "대상 상담실",
                "type": "string",
            },
            "start": {
                "description": "일정 시작 시각.",
                "format": "date-time",
                "title": "시작 시각",
                "type": "string",
            },
            "end": {
                "description": "일정 종료 시각.",
                "format": "date-time",
                "title": "종료 시각",
                "type": "string",
            },
            "member_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당자 멤버 UUID(선택). 제공 시 담당자 일정 중복까지 검사.",
                "title": "담당자",
            },
        },
        "required": ["room_id", "start", "end"],
    },
}
