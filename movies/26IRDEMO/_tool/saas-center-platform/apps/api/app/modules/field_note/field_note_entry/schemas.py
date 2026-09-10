from datetime import datetime
from pydantic import BaseModel, Field

from .models import FieldNoteEntryType, FieldNoteTagCategory


class FieldNoteEntryCreate(BaseModel):
    entry_type: FieldNoteEntryType
    tag_category: FieldNoteTagCategory | None = None
    content: str = Field(..., min_length=1)
    timestamp_seconds: float = Field(..., ge=0, description="녹음 시작 기준 경과 시간 (초)")


class FieldNoteEntryResponse(BaseModel):
    id: str
    field_note_id: str
    entry_type: str
    tag_category: str | None
    content: str
    timestamp_seconds: float
    created_at: datetime

    model_config = {"from_attributes": True}
