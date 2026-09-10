from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from .models import FormStatus

from app.modules.form.value.schemas import ValueResponse
from app.modules.form.signature.schemas import SignatureResponse


# Enum


# Request


class FormCreate(BaseModel):
    template_id: str = Field(..., description="템플릿 ID")


# Response


class FormSummary(BaseModel):
    id: str
    center_id: str
    template_id: str
    status: FormStatus
    created_by: str | None = None
    submitted_at: datetime | None
    submitted_by: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FormResponse(BaseModel):
    id: str
    center_id: str
    template_id: str
    status: FormStatus
    created_by: str | None = None
    submitted_at: datetime | None
    submitted_by: str | None = None
    created_at: datetime
    values: list[ValueResponse] = []
    signatures: list[SignatureResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FormListResponse(BaseModel):
    items: list[FormSummary]
    total: int
    page: int
    size: int
    pages: int
