from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VALID_TEMPLATE_TYPES = {"default", "soap", "dap", "birp", "family_center"}

NoteTemplateTypeLiteral = Literal["default", "soap", "dap", "birp", "family_center"]


class CenterNotePreferenceUpdate(BaseModel):
    default_template_type: NoteTemplateTypeLiteral = Field(
        ...,
        description="기본 노트 서식 (default, soap, dap, birp, family_center)",
    )


class CenterNotePreferenceResponse(BaseModel):
    id: str | None = None
    center_id: str
    default_template_type: str = "default"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
