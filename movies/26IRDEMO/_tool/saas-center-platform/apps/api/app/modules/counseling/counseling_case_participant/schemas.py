from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from .models import CaseParticipantType


class CounselingCaseParticipantCreate(BaseModel):
    participant_id: str = Field(..., description="참여자 ID (Client.id 또는 Member.id)")
    participant_type: CaseParticipantType = Field(..., description="역할")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "participant_id": "123e4567-e89b-12d3-a456-426614174000",
                "participant_type": "client"
            }
        }
    )


class CounselingCaseParticipantResponse(BaseModel):
    id: str
    center_id: str
    counseling_case_id: str
    participant_id: str
    participant_type: CaseParticipantType
    is_active: bool
    joined_at: datetime
    left_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CounselingCaseParticipantListResponse(BaseModel):
    items: list[CounselingCaseParticipantResponse]
