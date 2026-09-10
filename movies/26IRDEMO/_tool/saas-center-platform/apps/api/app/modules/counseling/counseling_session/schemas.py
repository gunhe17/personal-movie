from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from .models import CounselingSessionStatus as SessionStatus


class CancelSessionRequest(BaseModel):
    cancel_reason: str | None = Field(None, max_length=500, description="취소 사유")


class CounselingSessionCreate(BaseModel):
    counseling_case_id: str = Field(..., description="상담 케이스 ID")
    schedule_id: str = Field(..., description="일정 ID")
    session_number: int | None = Field(None, description="회기 번호 (1부터, 생략 시 NULL)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "counseling_case_id": "123e4567-e89b-12d3-a456-426614174000",
                "schedule_id": "223e4567-e89b-12d3-a456-426614174001"
            }
        }
    )


class CounselingSessionUpdate(BaseModel):
    status: SessionStatus | None = Field(None, description="상태")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "completed"
            }
        }
    )


class CounselingSessionResponse(BaseModel):
    id: str
    center_id: str
    counseling_case_id: str
    schedule_id: str
    status: SessionStatus
    cancel_reason: str | None = None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CounselingSessionSummary(BaseModel):
    id: str
    schedule_id: str
    status: SessionStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class CounselingSessionListResponse(BaseModel):
    items: list[CounselingSessionSummary]
    total: int
    page: int
    size: int
    pages: int


class UnloggedSessionItem(BaseModel):
    session_id: str
    counseling_case_id: str
    schedule_id: str
    completed_at: datetime | None


class UnloggedSessionListResponse(BaseModel):
    items: list[UnloggedSessionItem]
    total: int
    page: int
    size: int
    pages: int
