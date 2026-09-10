from datetime import datetime, time
from enum import Enum
from pydantic import BaseModel, Field, model_validator, ConfigDict

SLOT_MINUTES = 30  # 슬롯 단위(분) — 슬롯 격자·가용 판정 공용


class Weekday(str, Enum):
    MON = "MON"
    TUE = "TUE"
    WED = "WED"
    THU = "THU"
    FRI = "FRI"
    SAT = "SAT"
    SUN = "SUN"


class OperatingTimeCreate(BaseModel):
    weekday: Weekday
    open_time: time | None = None  # null = 휴무일
    close_time: time | None = None
    break_start_time: time | None = None
    break_end_time: time | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if (self.open_time is None) != (self.close_time is None):
            raise ValueError("open_time and close_time must be set together")
        if self.open_time and self.close_time:
            if self.open_time >= self.close_time:
                raise ValueError("open_time must be before close_time")
        if (self.open_time is None) and (self.break_start_time or self.break_end_time):
            raise ValueError("break time requires operating hours")
        if (self.break_start_time is None) != (self.break_end_time is None):
            raise ValueError("break_start_time and break_end_time must be set together")
        if self.break_start_time and self.break_end_time:
            if self.break_start_time >= self.break_end_time:
                raise ValueError("break_start_time must be before break_end_time")
        return self


class OperatingTimeBulkCreate(BaseModel):
    items: list[OperatingTimeCreate] = Field(..., min_length=7, max_length=7)

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
                    {
                        "weekday": "MON",
                        "open_time": "09:00",
                        "close_time": "18:00",
                        "break_start_time": "12:00",
                        "break_end_time": "13:00",
                    },
                    {
                        "weekday": "TUE",
                        "open_time": "09:00",
                        "close_time": "18:00",
                        "break_start_time": "12:00",
                        "break_end_time": "13:00",
                    },
                    {
                        "weekday": "WED",
                        "open_time": "09:00",
                        "close_time": "18:00",
                        "break_start_time": "12:00",
                        "break_end_time": "13:00",
                    },
                    {
                        "weekday": "THU",
                        "open_time": "09:00",
                        "close_time": "18:00",
                        "break_start_time": "12:00",
                        "break_end_time": "13:00",
                    },
                    {
                        "weekday": "FRI",
                        "open_time": "09:00",
                        "close_time": "18:00",
                        "break_start_time": "12:00",
                        "break_end_time": "13:00",
                    },
                    {"weekday": "SAT", "open_time": "10:00", "close_time": "15:00"},
                    {"weekday": "SUN", "open_time": None, "close_time": None},
                ]
            }
        }
    )


class OperatingTimeResponse(BaseModel):
    id: str
    center_id: str
    weekday: Weekday
    open_time: time | None
    close_time: time | None
    break_start_time: time | None
    break_end_time: time | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OperatingTimeSummary(BaseModel):
    id: str
    weekday: Weekday
    open_time: time | None
    close_time: time | None
    break_start_time: time | None
    break_end_time: time | None

    model_config = {"from_attributes": True}


# Operating Status 응답 스키마
class OperatingStatusSlotsResponse(BaseModel):
    date: str  # ISO 8601 날짜 (YYYY-MM-DD)
    available_slots: list[str]  # ["09:00", "09:30", ...]


class OperatingStatusSlotResponse(BaseModel):
    date: str  # ISO 8601 날짜 (YYYY-MM-DD)
    slot: str  # HH:MM 형식
    is_operating: bool
    reason: str | None = None


class RoomSlotStatusResponse(BaseModel):
    date: str  # ISO 8601 날짜 (YYYY-MM-DD)
    slot: str  # HH:MM 형식
    is_available: bool
    reason: str | None = None
