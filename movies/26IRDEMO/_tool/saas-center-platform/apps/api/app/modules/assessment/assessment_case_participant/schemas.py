from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class ParticipantType(str, Enum):
    CLIENT = "client"
    ASSISTANT = "assistant"


class ParticipantAdd(BaseModel):
    participant_type: ParticipantType
    participant_id: str


class ParticipantResponse(BaseModel):
    case_id: str
    participant_type: str
    participant_id: str
    assigned_at: datetime
    unassigned_at: datetime | None = None

    model_config = {"from_attributes": True}
