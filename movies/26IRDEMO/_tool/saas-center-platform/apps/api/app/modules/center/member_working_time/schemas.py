from datetime import datetime, time
from pydantic import BaseModel, Field, model_validator, ConfigDict

from ..center_operating_time.schemas import Weekday


class MemberWorkingTimeCreate(BaseModel):
    weekday: Weekday
    start_time: time | None = None  # null = 비근무일
    end_time: time | None = None  # null = 비근무일
    break_start_time: time | None = None
    break_end_time: time | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be set together")
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be before end_time")
        if (self.start_time is None) and (
            self.break_start_time or self.break_end_time
        ):
            raise ValueError("break time requires working hours")
        if (self.break_start_time is None) != (self.break_end_time is None):
            raise ValueError("break_start_time and break_end_time must be set together")
        if self.break_start_time and self.break_end_time:
            if self.break_start_time >= self.break_end_time:
                raise ValueError("break_start_time must be before break_end_time")
        return self


class MemberWorkingTimeBulkCreate(BaseModel):
    items: list[MemberWorkingTimeCreate] = Field(..., min_length=7, max_length=7)

    @model_validator(mode="after")
    def validate_all_weekdays(self):
        weekdays = {item.weekday for item in self.items}
        if len(weekdays) != 7:
            raise ValueError("All 7 weekdays must be provided")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [
                    {"weekday": "MON", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
                    {"weekday": "TUE", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
                    {"weekday": "WED", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
                    {"weekday": "THU", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
                    {"weekday": "FRI", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
                    {"weekday": "SAT", "start_time": None, "end_time": None},
                    {"weekday": "SUN", "start_time": None, "end_time": None}
                ]
            }
        }
    )


class MemberWorkingTimeResponse(BaseModel):
    id: str
    center_id: str
    member_id: str
    weekday: Weekday
    start_time: time | None
    end_time: time | None
    break_start_time: time | None
    break_end_time: time | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberWorkingTimeSummary(BaseModel):
    id: str
    weekday: Weekday
    start_time: time | None
    end_time: time | None

    model_config = {"from_attributes": True}


# Working Status 응답 스키마
class WorkingStatusSlotsResponse(BaseModel):
    date: str  # ISO 8601 날짜 (YYYY-MM-DD)
    available_slots: list[str]  # ["09:00", "09:30", ...]


class WorkingStatusSlotResponse(BaseModel):
    date: str  # ISO 8601 날짜 (YYYY-MM-DD)
    slot: str  # HH:MM 형식
    is_working: bool
    reason: str | None = None
