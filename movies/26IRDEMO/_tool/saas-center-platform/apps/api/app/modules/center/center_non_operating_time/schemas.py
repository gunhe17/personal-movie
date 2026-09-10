from datetime import datetime, time
from pydantic import BaseModel, Field, model_validator, ConfigDict

from ..center_operating_time.schemas import Weekday


class NonOperatingTimeCreate(BaseModel):
    year: int | None = Field(None, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    day: int | None = Field(None, ge=1, le=31)
    month_week: int | None = Field(None, ge=1, le=5)
    weekday: Weekday | None = None

    start_time: time | None = None  # null = 종일
    end_time: time | None = None

    effective_from: datetime | None = None  # 미지정 시 now()
    effective_to: datetime | None = None

    reason: str = Field(..., min_length=1, max_length=200)

    @model_validator(mode="after")
    def validate_pattern(self):
        if self.day is not None and self.month_week is not None:
            raise ValueError("Cannot specify both day and month_week")
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
                "month": 12,
                "day": 25,
                "reason": "크리스마스 휴무",
                "start_time": None,
                "end_time": None
            }
        }
    )


class NonOperatingTimeUpdate(BaseModel):
    start_time: time | None = None
    end_time: time | None = None
    effective_to: datetime | None = None
    reason: str | None = Field(None, min_length=1, max_length=200)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reason": "임시 휴무 (시설 보수)",
                "start_time": "14:00",
                "end_time": "18:00"
            }
        }
    )


class NonOperatingTimeResponse(BaseModel):
    id: str
    center_id: str
    year: int | None
    month: int | None
    day: int | None
    month_week: int | None
    weekday: Weekday | None
    start_time: time | None
    end_time: time | None
    effective_from: datetime
    effective_to: datetime | None
    reason: str
    created_by: str | None
    is_system_registered: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RegisterCenterHolidaysResponse(BaseModel):
    registered_count: int
    year: int
    items: list[NonOperatingTimeResponse]
