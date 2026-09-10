from datetime import datetime, date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

from .models import ScheduleType


class ScheduleCreate(BaseModel):
    member_id: str | None = Field(None, max_length=36, description="담당자 Member ID")
    schedule_type: ScheduleType
    title: str | None = Field(None, max_length=200)
    room_id: str | None = Field(None, max_length=36)
    start: datetime
    end: datetime
    memo: str | None = None

    @field_validator("end")
    def validate_end(cls, v, info):
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("종료 시간은 시작 시간보다 이후여야 합니다")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "member_id": "m1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "schedule_type": "counseling",
                "title": "개인 상담",
                "room_id": "r1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "start": "2024-03-20T14:00:00",
                "end": "2024-03-20T15:00:00",
                "memo": "첫 회기"
            }
        }
    )


class ScheduleUpdate(BaseModel):
    member_id: str | None = Field(None, max_length=36, description="담당자 Member ID")
    title: str | None = Field(None, max_length=200)
    room_id: str | None = Field(None, max_length=36)
    start: datetime | None = None
    end: datetime | None = None
    memo: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "member_id": "m1a2b3c4-d5e6-7f8g-9h0i-1j2k3l4m5n6o",
                "title": "가족 상담",
                "start": "2024-03-20T15:00:00",
                "end": "2024-03-20T16:30:00"
            }
        }
    )


class ClientSummary(BaseModel):
    client_id: str
    client_name: str
    attendance_status: str | None = None  # COMPLETED | NO_SHOW | CANCELLED

    model_config = {"from_attributes": True}


class AssessmentInfo(BaseModel):
    id: str | None = None
    code: str
    kor_name: str
    belongs_to_set: bool = False


class SessionCounselorInfo(BaseModel):
    counselor_id: str
    counselor_name: str


class SessionSummary(BaseModel):
    session_id: str
    case_id: str | None = None
    case_code: str | None = None
    case_type: str | None = None  # "individual" | "couple" | "family" | "group"
    session_number: int | None = None
    status: str | None = None  # "scheduled" | "completed" | "no_show" | "cancelled" | "attended"
    cancel_reason: str | None = None  # 취소 사유
    # Deprecated: 대표 담당자 1명 이름. 신규 코드는 `counselors` 리스트 사용.
    # 하위 호환을 위해 유지.
    counselor_name: str | None = None
    # 회기의 모든 담당자 (그룹 상담 다중 지원).
    # session_participants(type='counselor') 전체를 반환.
    counselors: list[SessionCounselorInfo] = []
    assessments: list[AssessmentInfo] = []  # 검사 목록
    program_id: str | None = None  # 상담 프로그램 ID
    program_name: str | None = None  # 상담 프로그램명 (counseling: Program.name, assessment: assessment_summary[0].kor_name)
    set_id: str | None = None  # 검사 세트 ID
    set_name: str | None = None  # 검사 패키지명
    clients: list[ClientSummary] = []

    model_config = {"from_attributes": True}


class ClientBrief(BaseModel):
    id: str
    name: str
    gender: str | None = None  # "male" | "female"
    birth_date: date | None = None


class ScheduleListItem(BaseModel):
    id: str
    start: datetime
    end: datetime
    schedule_type: ScheduleType
    room_name: str | None = None  # 상담실명
    # 대표 담당자 (schedule.member_id 기준). 캘린더 타일 색상/필터링 용도.
    counselor_name: str | None = None
    counselor_color: str | None = None  # 담당자 색상 (hex, 대표 기준)
    # 회기의 모든 담당자 이름 (그룹 상담 다중 지원).
    # 캘린더 호버 툴팁 등에서 전체 명단을 보여줄 때 사용.
    counselor_names: list[str] = []
    client_names: list[str] = []  # 내담자명 목록 (하위 호환)
    clients: list[ClientBrief] = []  # 내담자 상세 정보
    title: str | None
    program_name: str | None = None  # 프로그램명 (상담: Program.name, 검사: assessment_summary.kor_name)
    session_status: str | None = None  # 연결된 세션 상태 (cancelled 등)
    case_id: str | None = None  # 검사 케이스 ID (assessment 아이템만 — 필드노트 홈 검사 task 지연 로드용)
    session_id: str | None = None  # 상담 회기 ID (counseling 아이템만 — 홈 카드에서 회기 상세로 경유 없이 직접 이동용)

    model_config = {"from_attributes": True}


class ScheduleResponse(BaseModel):
    id: str
    center_id: str
    member_id: str | None
    schedule_type: ScheduleType
    title: str | None
    room_id: str | None
    room_name: str | None = None
    start: datetime
    end: datetime
    memo: str | None

    sessions: list[SessionSummary] = []

    has_conflict: bool = False
    conflicting_schedules: list["ConflictingSchedule"] = []

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

# 반복 일정 검증용 스키마


class RecurrencePattern(BaseModel):
    pattern: Literal["daily", "weekly", "monthly"] = Field(..., description="반복 유형")
    interval: int = Field(1, ge=1, le=100, description="반복 간격 (N일/N주/N개월마다)")
    count: int | None = Field(None, ge=1, le=100, description="총 반복 횟수")
    until: date | None = Field(None, description="반복 종료일 (YYYY-MM-DD)")
    days_of_week: Optional[list[Literal[
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ]]] = Field(None, description="요일 목록 (weekly 시)")
    monthly_repeat_types: Optional[list[Literal[
        "day", "weekday", "last_weekday", "last_day"
    ]]] = Field(None, description="월간 반복 타입 (monthly 시)")

    @model_validator(mode="after")
    def validate_end_condition(self):
        if self.count is None and self.until is None:
            raise ValueError("count 또는 until 중 하나는 필수입니다")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "pattern": "daily",
                    "interval": 1,
                    "count": 3,
                },
                {
                    "pattern": "weekly",
                    "interval": 1,
                    "days_of_week": ["monday", "wednesday", "friday"],
                    "count": 6,
                },
                {
                    "pattern": "monthly",
                    "interval": 1,
                    "monthly_repeat_types": ["day", "weekday"],
                    "count": 3,
                },
            ]
        }
    )


class BatchScheduleValidation(BaseModel):
    start_date: date = Field(..., description="시작일")
    start_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$", description="시작 시간 (HH:MM)")
    recurrence: RecurrencePattern
    room_id: str = Field(..., description="장소 ID")
    duration_minutes: int = Field(..., ge=10, le=480, description="소요 시간 (분)")
    member_id: str | None = Field(None, description="담당자 Member ID (선택). 제공 시 담당자 중복까지 경고")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "start_date": "2026-01-06",
                "start_time": "14:00",
                "recurrence": {
                    "pattern": "weekly",
                    "interval": 1,
                    "days_of_week": ["monday", "wednesday"],
                    "count": 10
                },
                "room_id": "room-uuid",
                "duration_minutes": 50,
                "member_id": None
            }
        }
    )


class ConflictingSchedule(BaseModel):
    id: str
    title: str | None
    start: datetime
    end: datetime
    schedule_type: str
    room_id: str | None = None
    room_name: str | None = None
    member_id: str | None = None
    conflict_reason: Literal["room", "member", "both"] = "room"

    model_config = {"from_attributes": True}

    @classmethod
    def from_schedule(
        cls,
        schedule,
        check_room_id: str | None,
        check_member_id: str | None,
        room_name: str | None = None,
    ) -> "ConflictingSchedule":
        # repo 필터에 걸린 행이라 room/member 중 최소 한쪽은 매칭 — 안전 fallback "room"
        room_match = bool(check_room_id and schedule.room_id == check_room_id)
        member_match = bool(check_member_id and schedule.member_id == check_member_id)
        if room_match and member_match:
            reason = "both"
        elif member_match:
            reason = "member"
        else:
            reason = "room"
        return cls(
            id=schedule.id,
            title=schedule.title,
            start=schedule.start,
            end=schedule.end,
            schedule_type=schedule.schedule_type,
            room_id=schedule.room_id,
            room_name=room_name,
            member_id=schedule.member_id,
            conflict_reason=reason,
        )


class ScheduleConflictDetail(BaseModel):
    session_number: int = Field(..., description="회기 번호 (1부터 시작)")
    date: datetime = Field(..., description="해당 회기 일정")
    conflicting_schedules: list[ConflictingSchedule]


class ScheduleValidationResponse(BaseModel):
    has_conflicts: bool = Field(..., description="충돌 여부")
    total_schedules: int = Field(..., description="총 일정 개수")
    conflicts: list[ScheduleConflictDetail] = Field(default=[], description="충돌 상세 목록 (상한 적용될 수 있음)")
    truncated: bool = Field(False, description="conflicts가 상한에 의해 잘렸는지 여부")
    truncated_count: int = Field(0, description="상한 초과로 잘려나간 회기 수 (truncated가 True일 때만 의미 있음)")
    validated_data: BatchScheduleValidation = Field(..., description="검증에 사용된 데이터")
    schedule_dates: list[datetime] = Field(..., description="계산된 일정 날짜 목록 (재사용용)")


# 단건 일정 충돌 검증용 스키마


class SingleScheduleValidation(BaseModel):
    room_id: str = Field(..., description="장소 ID")
    start: datetime = Field(..., description="시작 시간")
    end: datetime = Field(..., description="종료 시간")
    member_id: str | None = Field(None, description="담당자 Member ID (선택). 제공 시 담당자 중복까지 경고")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "room_id": "room-uuid",
                "start": "2026-01-06T05:00:00",
                "end": "2026-01-06T06:00:00",
                "member_id": None
            }
        }
    )


class SingleScheduleValidationResponse(BaseModel):
    has_conflicts: bool = Field(..., description="충돌 여부")
    conflicting_schedules: list[ConflictingSchedule] = Field(default=[], description="충돌하는 일정 목록")


# 멀티 날짜 일정 충돌 검증용 스키마


class DatesScheduleValidation(BaseModel):
    dates: list[datetime] = Field(..., min_length=1, max_length=100, description="검증할 날짜 목록 (로컬 날짜, 날짜 부분만 사용)")
    start_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$", description="시작 시간 (HH:MM)")
    end_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$", description="종료 시간 (HH:MM)")
    room_id: str = Field(..., description="장소 ID")
    exclude_schedule_id: str | None = Field(None, description="제외할 Schedule ID (수정 시 자기 자신 제외)")
    member_id: str | None = Field(None, description="담당자 Member ID (선택). 제공 시 담당자 중복까지 경고")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dates": ["2026-03-20T00:00:00", "2026-03-22T00:00:00", "2026-03-25T00:00:00"],
                "start_time": "14:00",
                "end_time": "15:00",
                "room_id": "room-uuid",
                "exclude_schedule_id": None,
                "member_id": None
            }
        }
    )


class DatesScheduleValidationResponse(BaseModel):
    has_conflicts: bool = Field(..., description="충돌 여부")
    total_schedules: int = Field(..., description="총 일정 개수")
    conflicts: list[ScheduleConflictDetail] = Field(default=[], description="충돌 상세 목록 (상한 적용될 수 있음)")
    truncated: bool = Field(False, description="conflicts가 상한에 의해 잘렸는지 여부")
    truncated_count: int = Field(0, description="상한 초과로 잘려나간 날짜 수")


# Forward reference 해결 — ScheduleResponse가 뒤에 정의되는 ConflictingSchedule을 참조.
ScheduleResponse.model_rebuild()
