from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    BatchScheduleValidation,
    ScheduleValidationResponse,
)
from app.modules.center.facade import RoomFacade
from .enrich_conflict_room_names import enrich_conflict_detail_room_names


async def validate_recurring_schedules_handler(
    center_id: str,
    data: BatchScheduleValidation,
    uow: UnitOfWork,
) -> ScheduleValidationResponse:
    schedule_facade = ScheduleFacade(uow)
    result = await schedule_facade.validate_recurring_schedules(center_id, data)

    await enrich_conflict_detail_room_names(RoomFacade(uow), result.conflicts)

    return result


TOOL = {
    "name": "validate_recurring_schedules_handler",
    "permission": "read:schedule",
    "purpose": "여러 일정을 만들기 전에 충돌·유효성을 일괄 검증한다.",
    "keywords": [
        "validate batch schedules",
        "일정 검증",
        "충돌 확인",
        "스케줄 유효성",
        "배치 일정 검증",
        "겹침 확인",
    ],
    "boundaries": "여러 일정의 충돌/유효성을 '사전 검증'(생성 아님). 날짜 단위 검증은 validate_schedule_dates_handler.",
    "output": "일괄 검증 결과: 충돌·유효성 (ScheduleValidationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "start_date": {
                "description": "첫 일정 시작일.",
                "format": "date",
                "title": "시작일",
                "type": "string",
            },
            "start_time": {
                "description": "시작 시간(HH:MM).",
                "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
                "title": "시작 시간",
                "type": "string",
            },
            "recurrence": {
                "$ref": "#/$defs/RecurrencePattern",
                "description": "반복 패턴(일간/주간/월간, 간격·횟수 등).",
            },
            "room_id": {
                "description": "상담실(장소)의 UUID.",
                "title": "대상 상담실",
                "type": "string",
            },
            "duration_minutes": {
                "description": "회당 소요 시간(분, 10~480).",
                "maximum": 480,
                "minimum": 10,
                "title": "소요 시간",
                "type": "integer",
            },
            "member_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "담당자 member_id(선택). 제공 시 담당자 일정 중복까지 검사.",
                "title": "담당자",
            },
        },
        "$defs": {
            "RecurrencePattern": {
                "examples": [
                    {"count": 3, "interval": 1, "pattern": "daily"},
                    {
                        "count": 6,
                        "days_of_week": ["monday", "wednesday", "friday"],
                        "interval": 1,
                        "pattern": "weekly",
                    },
                    {
                        "count": 3,
                        "interval": 1,
                        "monthly_repeat_types": ["day", "weekday"],
                        "pattern": "monthly",
                    },
                ],
                "properties": {
                    "pattern": {
                        "description": "반복 유형",
                        "enum": ["daily", "weekly", "monthly"],
                        "title": "Pattern",
                        "type": "string",
                    },
                    "interval": {
                        "default": 1,
                        "description": "반복 간격 (N일/N주/N개월마다)",
                        "maximum": 100,
                        "minimum": 1,
                        "title": "Interval",
                        "type": "integer",
                    },
                    "count": {
                        "anyOf": [
                            {"maximum": 100, "minimum": 1, "type": "integer"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "총 반복 횟수",
                        "title": "Count",
                    },
                    "until": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "반복 종료일 (YYYY-MM-DD)",
                        "title": "Until",
                    },
                    "days_of_week": {
                        "anyOf": [
                            {
                                "items": {
                                    "enum": [
                                        "monday",
                                        "tuesday",
                                        "wednesday",
                                        "thursday",
                                        "friday",
                                        "saturday",
                                        "sunday",
                                    ],
                                    "type": "string",
                                },
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "요일 목록 (weekly 시)",
                        "title": "Days Of Week",
                    },
                    "monthly_repeat_types": {
                        "anyOf": [
                            {
                                "items": {
                                    "enum": [
                                        "day",
                                        "weekday",
                                        "last_weekday",
                                        "last_day",
                                    ],
                                    "type": "string",
                                },
                                "type": "array",
                            },
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "월간 반복 타입 (monthly 시)",
                        "title": "Monthly Repeat Types",
                    },
                },
                "required": ["pattern"],
                "title": "RecurrencePattern",
                "type": "object",
            }
        },
        "required": [
            "start_date",
            "start_time",
            "recurrence",
            "room_id",
            "duration_minutes",
        ],
    },
}
