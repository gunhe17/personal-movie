from datetime import datetime

from pydantic import BaseModel, Field

from .constants import TemplateType


class VariableSchema(BaseModel):
    key: str
    label: str
    required: bool = True


class MessageTemplateCreate(BaseModel):
    template_type: TemplateType
    name: str = Field(max_length=100)
    content: str = Field(min_length=1)
    is_default: bool = False


class MessageTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    content: str | None = Field(default=None, min_length=1)


class MessageTemplateResponse(BaseModel):
    id: str
    center_id: str | None
    template_type: str
    name: str
    content: str
    variables: list[VariableSchema]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageTemplateSummary(BaseModel):
    id: str
    center_id: str | None
    template_type: str
    name: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageTemplateListResponse(BaseModel):
    items: list[MessageTemplateSummary]
    total: int
    page: int
    size: int
    pages: int


class MessageTemplatePreviewRequest(BaseModel):
    content: str
    variables: dict[str, str] = {}


class MessageTemplatePreviewResponse(BaseModel):
    rendered_content: str


class DefaultTemplateResponse(BaseModel):
    template: MessageTemplateResponse | None = None
    fallback_content: str
    builtin_content: str = ""
    source: str = Field(description="template | system | hardcoded")
