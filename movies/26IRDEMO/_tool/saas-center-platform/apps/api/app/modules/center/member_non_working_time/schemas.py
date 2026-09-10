from datetime import datetime, time
from enum import Enum
from pydantic import BaseModel, Field, model_validator, ConfigDict

from ..member_working_time.schemas import Weekday


class MemberNonWorkingTimeReason(str, Enum):
    ANNUAL_LEAVE = "ANNUAL_LEAVE"  # 연차
    HALF_DAY_AM = "HALF_DAY_AM"  # 오전 반차
    HALF_DAY_PM = "HALF_DAY_PM"  # 오후 반차
    SICK_LEAVE = "SICK_LEAVE"  # 병가
    PERSONAL = "PERSONAL"  # 개인 사정
    TRAINING = "TRAINING"  # 교육/연수
    BUSINESS_TRIP = "BUSINESS_TRIP"  # 출장/외근
    OTHER = "OTHER"  # 기타


class MemberNonWorkingTimeCreate(BaseModel):
    # Date Pattern
    year: int | None = Field(None, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    day: int | None = Field(None, ge=1, le=31)
    month_week: int | None = Field(None, ge=1, le=5)  # 1-5번째 주
    weekday: Weekday | None = None

    # Time Range (null = 종일)
    start_time: time | None = None
    end_time: time | None = None

    # Effective Period
    effective_from: datetime | None = None  # 미지정 시 now()
    effective_to: datetime | None = None

    # Metadata
    reason: MemberNonWorkingTimeReason
    description: str | None = Field(None, max_length=200)

    @model_validator(mode="after")
    def validate_pattern(self):
        # day와 month_week는 동시 사용 불가
        if self.day is not None and self.month_week is not None:
            raise ValueError("Cannot specify both day and month_week")
        # time 범위 검증
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be set together")
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be before end_time")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "year": 2024,
                "month": 8,
                "day": 15,
                "reason": "ANNUAL_LEAVE",
                "description": "하계 휴가",
                "start_time": None,
                "end_time": None,
            }
        }
    )


class MemberNonWorkingTimeUpdate(BaseModel):
    start_time: time | None = None
    end_time: time | None = None
    effective_to: datetime | None = None
    reason: MemberNonWorkingTimeReason | None = None
    description: str | None = Field(None, max_length=200)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "reason" in self.model_fields_set and self.reason is None:
            raise ValueError("reason cannot be null (omit the field to keep unchanged)")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"reason": "SICK_LEAVE", "description": "병가 (독감)"}
        }
    )


class MemberNonWorkingTimeResponse(BaseModel):
    id: str
    center_id: str
    member_id: str
    year: int | None
    month: int | None
    day: int | None
    month_week: int | None
    weekday: Weekday | None
    start_time: time | None
    end_time: time | None
    effective_from: datetime
    effective_to: datetime | None
    reason: MemberNonWorkingTimeReason
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberNonWorkingTimeSummary(BaseModel):
    id: str
    year: int | None
    month: int | None
    day: int | None
    start_time: time | None
    end_time: time | None
    reason: MemberNonWorkingTimeReason
    description: str | None

    model_config = {"from_attributes": True}


class MemberNonWorkingTimeListResponse(BaseModel):
    items: list[MemberNonWorkingTimeSummary]
    total: int
    page: int
    size: int
    pages: int
