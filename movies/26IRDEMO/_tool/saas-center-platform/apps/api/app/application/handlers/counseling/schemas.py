from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from app.modules.schedule.schedule.schemas import RecurrencePattern


class SessionScheduleInput(BaseModel):
    # 두 모드: dates(직접 날짜 배열 + start_time/end_time) / recurrence 레거시(start + recurrence 패턴)
    # 모드 1: 직접 날짜 선택 (멀티 날짜)
    dates: list[datetime] | None = Field(
        None,
        description="직접 선택한 날짜+시간 배열 (ISO 8601 UTC)"
    )
    start_time: str | None = Field(
        None,
        description="시작 시간 (HH:MM, dates 모드에서 사용)"
    )
    end_time: str | None = Field(
        None,
        description="종료 시간 (HH:MM, dates 모드에서 사용)"
    )

    # 모드 2: 반복 패턴 (하위 호환)
    start: datetime | None = Field(
        None,
        description="시작 일시 (ISO 8601 UTC, recurrence 모드)"
    )
    recurrence: RecurrencePattern | None = Field(
        None,
        description="반복 패턴 (선택적). 없으면 단일 회기만 생성"
    )

    # 패턴 저장 (dates 모드에서 감지된 패턴을 session_rule로 저장)
    session_rule: dict | None = Field(
        None,
        description="감지된 반복 패턴 (프론트에서 전달, case.session_rule에 저장)"
    )

    # 공통
    room_id: str = Field(..., description="장소 ID")
    duration_minutes: int = Field(50, ge=10, le=480, description="소요 시간 (분)")
    memo: str | None = Field(None, max_length=2000, description="일정에 표시될 메모")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dates": ["2026-01-06T05:00:00Z", "2026-01-13T05:00:00Z"],
                "start_time": "14:00",
                "end_time": "15:00",
                "room_id": "room-uuid",
                "duration_minutes": 60
            }
        }
    )


class CounselingCaseInput(BaseModel):
    program_id: str = Field(..., description="프로그램 ID")
    client_ids: list[str] = Field(..., min_length=1, description="내담자 ID 목록")
    counselor_ids: list[str] = Field(..., min_length=1, description="상담사 ID 목록 (첫번째가 주담당)")
    chief_complaint: str | None = Field(None, max_length=1000, description="주호소")
    memo: str | None = Field(None, max_length=2000, description="메모")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "program_id": "program-uuid",
                "client_ids": ["client-uuid-1"],
                "counselor_ids": ["counselor-uuid-1"],
                "chief_complaint": "발음 문제",
                "memo": "부모 상담 필요"
            }
        }
    )


class CaseWithSessionsCreate(BaseModel):
    case: CounselingCaseInput
    sessions: SessionScheduleInput

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "case": {
                    "program_id": "program-uuid",
                    "client_ids": ["client-uuid-1"],
                    "counselor_ids": ["counselor-uuid-1"],
                    "chief_complaint": "발음 문제",
                    "memo": '메모'
                },
                "sessions": {
                    "start": "2026-01-06T05:00:00Z",
                    "recurrence": {
                        "pattern": "weekly",
                        "count": 10,
                        "day_of_week": "monday"
                    },
                    "room_id": "room-uuid",
                    "duration_minutes": 50
                }
            }
        }
    )


class SessionSummary(BaseModel):
    id: str
    session_number: int
    schedule_id: str
    start: datetime
    end: datetime
    room_id: str | None

    model_config = {"from_attributes": True}


class CaseWithSessionsResponse(BaseModel):
    case_id: str
    case_code: str
    total_sessions: int
    sessions: list[SessionSummary]
    created_at: datetime
    warnings: list[str] = Field(default_factory=list, description="일정 충돌 경고 메시지")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "case_id": "case-uuid",
                "case_code": "C00001",
                "total_sessions": 10,
                "sessions": [
                    {
                        "id": "session-uuid-1",
                        "session_number": 1,
                        "schedule_id": "schedule-uuid-1",
                        "start": "2026-01-06T14:00:00",
                        "end": "2026-01-06T14:50:00",
                        "room_id": "room-uuid"
                    }
                ],
                "created_at": "2026-01-01T10:00:00"
            }
        }
    )
