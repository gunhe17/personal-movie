from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# Enum


class FieldType(str, Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    EMAIL = "email"
    PHONE = "phone"
    NUMBER = "number"
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX_GROUP = "checkbox_group"
    FILE = "file"
    IMAGE = "image"
    SIGNATURE = "signature"


# Request


class TemplateCreate(BaseModel):
    name: str = Field(..., max_length=100, description="템플릿 이름")
    schema_: dict[str, Any] = Field(..., alias="schema", description="필드/레이아웃 정의")


class TemplateCloneCreate(BaseModel):
    name: str = Field(..., max_length=100, description="센터 템플릿 이름")
    schema_: dict[str, Any] | None = Field(
        None, alias="schema", description="커스터마이징된 스키마 (없으면 원본 사용)"
    )


class TemplateVersionCreate(BaseModel):
    schema_: dict[str, Any] = Field(..., alias="schema", description="수정된 필드/레이아웃 정의")


class TemplateDraftUpdate(BaseModel):
    schema_: dict[str, Any] = Field(..., alias="schema", description="덮어쓸 필드/레이아웃 정의")


class TemplateStatusUpdate(BaseModel):
    is_active: bool = Field(..., description="활성 여부 (True=활성, False=비활성)")


# Response


class TemplateSummary(BaseModel):
    id: str
    center_id: str | None
    source_template_id: str | None = None
    name: str
    version: int
    schema_: dict[str, Any] = Field(..., alias="schema")
    is_active: bool
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TemplateResponse(BaseModel):
    id: str
    center_id: str | None
    source_template_id: str | None = None
    name: str
    version: int
    schema_: dict[str, Any] = Field(..., alias="schema")
    is_active: bool
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TemplateListResponse(BaseModel):
    items: list[TemplateSummary]
    total: int
    page: int
    size: int
    pages: int


class GenerateDraftRequest(BaseModel):
    description: str = Field(default="", description="만들고 싶은 양식의 자연어 설명")


class FormDraftResponse(BaseModel):
    schema_: dict[str, Any] = Field(..., alias="schema")

    model_config = ConfigDict(populate_by_name=True)
