from dataclasses import dataclass
from datetime import datetime, date, time
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

from .models import CounselingCaseStatus as CaseStatus


class CounselingCaseCreate(BaseModel):
    program_id: str = Field(..., description="상담 프로그램 ID")
    chief_complaint: str | None = Field(None, max_length=1000, description="주호소")
    memo: str | None = Field(None, max_length=2000, description="메모")
    total_sessions: int | None = Field(None, ge=1, le=999, description="총 회기 수")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "program_id": "123e4567-e89b-12d3-a456-426614174000",
                "chief_complaint": "최근 3개월간 무기력감과 집중력 저하",
                "total_sessions": 10
            }
        }
    )


class CounselingCaseUpdate(BaseModel):
    counselor_id: str | None = Field(None, description="담당 상담사 ID")
    chief_complaint: str | None = Field(None, max_length=1000, description="주호소")
    memo: str | None = Field(None, max_length=2000, description="메모")
    total_sessions: int | None = Field(None, ge=1, le=999, description="총 회기 수")
    status: CaseStatus | None = Field(None, description="상태")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "counselor_id": "counselor-uuid",
                "chief_complaint": "최근 불안 증상 증가",
                "total_sessions": 12,
                "status": "active"
            }
        }
    )


class CounselingCaseResponse(BaseModel):
    id: str
    case_code: str
    center_id: str
    program_id: str
    counselor_id: str
    chief_complaint: str | None
    memo: str | None
    total_sessions: int | None
    session_rule: dict | None = None
    status: CaseStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CounselingCaseSummary(BaseModel):
    id: str
    case_code: str
    program_id: str
    total_sessions: int
    status: CaseStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class CounselingCaseListResponse(BaseModel):
    items: list[CounselingCaseSummary]
    total: int
    page: int
    size: int
    pages: int


class RescheduleSettings(BaseModel):
    pattern: Literal["weekly", "biweekly"] = Field(
        ...,
        description="반복 패턴 (weekly: 매주, biweekly: 격주)"
    )
    day_of_week: str = Field(
        ...,
        description="요일 (monday, tuesday, wednesday, thursday, friday, saturday, sunday)"
    )
    start_time: time = Field(
        ...,
        description="회기 시작 시간 (HH:MM:SS 형식)"
    )
    duration_minutes: int = Field(
        ...,
        ge=10,
        le=480,
        description="회기 소요 시간 (분, 10~480분)"
    )
    room_id: str | None = Field(
        None,
        description="상담실 ID (선택적, 없으면 미지정)"
    )
    start_date: date = Field(
        ...,
        description="첫 회기 날짜 (YYYY-MM-DD 형식)"
    )
    remaining_sessions_count: int = Field(
        ...,
        ge=1,
        description="생성할 회기 개수 (기존 예약 회기 포함, 최소 1개)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "pattern": "weekly",
                "day_of_week": "monday",
                "start_time": "14:00:00",
                "duration_minutes": 60,
                "room_id": "123e4567-e89b-12d3-a456-426614174000",
                "start_date": "2026-03-01",
                "remaining_sessions_count": 5
            }
        }
    )


class CounselingCaseUpdateWithReschedule(BaseModel):
    counselor_id: str | None = Field(
        None,
        description="담당 상담사 ID (변경 시 기존 예약된 회기들의 담당자도 함께 변경됨)"
    )
    chief_complaint: str | None = Field(
        None,
        max_length=1000,
        description="주호소 (Chief Complaint)"
    )
    memo: str | None = Field(
        None,
        max_length=2000,
        description="메모"
    )
    total_sessions: int | None = Field(
        None,
        ge=1,
        le=999,
        description="총 회기 수 (이미 소진한 회기 수보다 작을 수 없음)"
    )
    status: CaseStatus | None = Field(
        None,
        description="상태 (active: 진행중, completed: 종결, cancelled: 취소). 종결/취소 시 예약된 회기가 있으면 오류 발생"
    )
    reschedule_settings: RescheduleSettings | None = Field(
        None,
        description="회기 재설정 정보 (제공 시 기존 예약된 회기를 취소하고 새 패턴으로 재생성)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "counselor_id": "new-counselor-uuid",
                "total_sessions": 15,
                "reschedule_settings": {
                    "pattern": "weekly",
                    "day_of_week": "monday",
                    "start_time": "14:00:00",
                    "duration_minutes": 60,
                    "start_date": "2026-03-01",
                    "remaining_sessions_count": 5,
                    "room_id": "room-uuid"
                }
            }
        }
    )


class ValidateUpdateRequest(BaseModel):
    counselor_id: str | None = None
    chief_complaint: str | None = None
    memo: str | None = None
    total_sessions: int | None = None
    status: CaseStatus | None = None
    reschedule_settings: RescheduleSettings | None = None


class ValidationError(BaseModel):
    field: str = Field(..., description="오류 필드")
    message: str = Field(..., description="오류 메시지")
    code: str = Field(..., description="오류 코드")


class ValidationWarning(BaseModel):
    field: str = Field(..., description="경고 필드")
    message: str = Field(..., description="경고 메시지")


class ValidateUpdateResponse(BaseModel):
    valid: bool = Field(..., description="검증 통과 여부 (true: 수정 가능, false: 오류 있음)")
    errors: list[ValidationError] = Field(
        default_factory=list,
        description="검증 오류 목록 (수정 불가능한 문제)"
    )
    warnings: list[ValidationWarning] = Field(
        default_factory=list,
        description="경고 목록 (수정 가능하지만 주의 필요)"
    )
    max_consumed_count: int | None = Field(
        None,
        description="현재 최대 소진 회기 수 (그룹 상담의 경우 참여자별 최대값)"
    )
    scheduled_count: int | None = Field(
        None,
        description="현재 예약된 회기 수 (scheduled 상태)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "summary": "검증 성공",
                    "description": "수정 가능한 상태",
                    "value": {
                        "valid": True,
                        "errors": [],
                        "warnings": [],
                        "max_consumed_count": 3,
                        "scheduled_count": 2
                    }
                },
                {
                    "summary": "검증 실패 - 총 회기 수 부족",
                    "description": "이미 소진한 회기보다 작은 총 회기 수",
                    "value": {
                        "valid": False,
                        "errors": [
                            {
                                "field": "total_sessions",
                                "message": "총 회기 수는 최소 5개 이상이어야 합니다. (현재 소진: 5개)",
                                "code": "MIN_SESSIONS_VIOLATED"
                            }
                        ],
                        "warnings": [],
                        "max_consumed_count": 5,
                        "scheduled_count": 3
                    }
                },
                {
                    "summary": "경고 포함",
                    "description": "수정 가능하지만 예약 회기 취소 경고",
                    "value": {
                        "valid": True,
                        "errors": [],
                        "warnings": [
                            {
                                "field": "reschedule_settings",
                                "message": "예약된 3개 회기가 취소되고 새로 생성됩니다."
                            }
                        ],
                        "max_consumed_count": 5,
                        "scheduled_count": 3
                    }
                }
            ]
        }
    )


@dataclass
class CreateCounselingCaseCommand:
    center_id: str
    counselor_id: str
    program_id: str
    chief_complaint: str | None = None
    memo: str | None = None
    total_sessions: int | None = None
    session_rule: dict | None = None

