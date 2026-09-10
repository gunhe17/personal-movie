from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ScheduleChangeRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    schedule_id: str
    person_id: str
    client_id: str
    current_start: datetime
    current_end: datetime
    requested_start: datetime
    requested_end: datetime
    reason: str | None = None
    status: str
    decided_by_member_id: str | None = None
    decided_at: datetime | None = None
    decision_note: str | None = None
    created_at: datetime


class ScheduleChangeRequestReject(BaseModel):
    reason: str = Field(max_length=500)


class ScheduleChangeRequestSummary(BaseModel):
    id: str
    center_id: str
    schedule_id: str
    client_id: str
    client_name: str | None = None
    # 내담자 표시 최소 단위(아바타 + 이름 + 생년월일|성별) — 화면 공통 규격
    client_birth_date: date | None = None
    client_gender: str | None = None
    client_profile_image_url: str | None = None
    title: str | None = None
    program_name: str | None = None
    session_number: int | None = None
    room_name: str | None = None
    counselor_name: str | None = None
    current_start: datetime
    current_end: datetime
    requested_start: datetime
    requested_end: datetime
    reason: str | None = None
    status: str
    decision_note: str | None = None
    decided_at: datetime | None = None
    created_at: datetime
