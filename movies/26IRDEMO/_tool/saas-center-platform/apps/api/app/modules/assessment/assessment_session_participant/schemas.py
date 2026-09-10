from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

from ..assessment_case_participant.schemas import ParticipantType


# 검사 출석의 정본은 회기 단위 전이(assessment_session attend/no_show) — 참여자 단위 출석 값은 소멸됨(2026-07-10)
class AttendanceStatus(str, Enum):
    SCHEDULED = "scheduled"


class SessionParticipantCreate(BaseModel):
    participant_type: ParticipantType
    participant_id: str = Field(..., description="참여자 ID (Client 또는 Member UUID)")


class SessionParticipantBatchCreate(BaseModel):
    client_ids: list[str] = Field(default_factory=list, description="내담자 ID 목록")
    assistant_ids: list[str] = Field(default_factory=list, description="보조 검사자 ID 목록")


class SessionParticipantResponse(BaseModel):
    id: str
    center_id: str
    session_id: str
    participant_type: ParticipantType
    participant_id: str
    attendance_status: AttendanceStatus
    attended_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionParticipantSummary(BaseModel):
    id: str
    participant_type: ParticipantType
    participant_id: str
    attendance_status: AttendanceStatus

    model_config = {"from_attributes": True}
