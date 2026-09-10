from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

from .models import SessionStatus


class CancelSessionRequest(BaseModel):
    cancel_reason: str | None = Field(None, max_length=500, description="취소 사유")


class AssessmentSessionCreate(BaseModel):
    schedule_id: str | None = None  # ScheduledRelation 연결용


class AssessmentSessionUpdate(BaseModel):
    status: SessionStatus | None = None


class AssessmentSessionResponse(BaseModel):
    id: str
    center_id: str
    case_id: str
    schedule_id: str | None
    status: str
    cancel_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
