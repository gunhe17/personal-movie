from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator

from .models import AttendanceStatus, ParticipantType


class SessionParticipantCreate(BaseModel):
    participant_type: ParticipantType
    participant_id: str = Field(
        ..., description="참여자 ID (CounselingCaseParticipant.participant_id)"
    )


class SessionParticipantBatchCreate(BaseModel):
    client_ids: list[str] = Field(default_factory=list, description="내담자 ID 목록")
    counselor_ids: list[str] = Field(default_factory=list, description="상담사 ID 목록")


class SessionParticipantUpdate(BaseModel):
    attendance_status: AttendanceStatus | None = Field(None, description="출석 상태")
    is_consumed: bool | None = Field(None, description="회기 소진 여부")
    memo: str | None = Field(None, max_length=500, description="출석 메모")

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        for field in ("attendance_status", "is_consumed"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null (omit the field to keep unchanged)"
                )
        return self


class SessionParticipantResponse(BaseModel):
    id: str
    center_id: str
    session_id: str
    participant_type: ParticipantType
    participant_id: str
    participant_name: str | None = None
    gender: str | None = None
    birth_date: date | None = None
    attendance_status: AttendanceStatus
    is_consumed: bool
    attended_at: datetime | None
    memo: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionParticipantSummary(BaseModel):
    id: str
    participant_type: ParticipantType
    participant_id: str
    attendance_status: AttendanceStatus

    model_config = {"from_attributes": True}


class SessionParticipantListResponse(BaseModel):
    items: list[SessionParticipantResponse]
    total: int
