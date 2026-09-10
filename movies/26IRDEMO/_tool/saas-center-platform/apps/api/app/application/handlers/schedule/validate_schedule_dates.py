from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    DatesScheduleValidation,
    DatesScheduleValidationResponse,
)
from app.modules.center.facade import RoomFacade
from .enrich_conflict_room_names import enrich_conflict_detail_room_names


async def validate_schedule_dates_handler(
    center_id: str,
    data: DatesScheduleValidation,
    uow: UnitOfWork,
) -> DatesScheduleValidationResponse:
    schedule_facade = ScheduleFacade(uow)
    result = await schedule_facade.validate_schedule_dates(
        center_id=center_id,
        dates=data.dates,
        start_time=data.start_time,
        end_time=data.end_time,
        room_id=data.room_id,
        exclude_schedule_id=data.exclude_schedule_id,
        member_id=data.member_id,
    )

    await enrich_conflict_detail_room_names(RoomFacade(uow), result.conflicts)

    return result


TOOL = {
    "name": "validate_schedule_dates_handler",
    "permission": "read:schedule",
    "purpose": "여러 날짜에 대한 일정 생성 가능성을 사전 검증한다.",
    "keywords": [
        "validate dates schedules",
        "날짜 일정 검증",
        "반복 일정 확인",
        "날짜별 충돌",
        "일정 가능일 검증",
    ],
    "boundaries": "날짜 목록 기준 일정 가능성 '사전 검증'. 일정 묶음 검증은 validate_recurring_schedules_handler.",
    "output": "날짜별 검증 결과 (DatesScheduleValidationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "dates": {
                "description": "검증할 날짜 목록(로컬 날짜, 최대 100).",
                "items": {"format": "date-time", "type": "string"},
                "maxItems": 100,
                "minItems": 1,
                "title": "날짜 목록",
                "type": "array",
            },
            "start_time": {
                "description": "시작 시간(HH:MM).",
                "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
                "title": "시작 시간",
                "type": "string",
            },
            "end_time": {
                "description": "종료 시간(HH:MM).",
                "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
                "title": "종료 시간",
                "type": "string",
            },
            "room_id": {
                "description": "상담실(장소)의 UUID.",
                "title": "대상 상담실",
                "type": "string",
            },
            "exclude_schedule_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "검사에서 제외할 일정 UUID(수정 시 자기 자신 제외).",
                "title": "제외 일정",
            },
            "member_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당자 member_id(선택). 제공 시 담당자 일정 중복까지 검사.",
                "title": "담당자",
            },
        },
        "required": ["dates", "start_time", "end_time", "room_id"],
    },
}
