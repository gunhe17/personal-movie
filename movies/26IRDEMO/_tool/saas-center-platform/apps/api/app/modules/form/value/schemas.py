from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# Request


class ValueItem(BaseModel):
    field_key: str = Field(..., max_length=100, description="필드 키")
    group_index: int = Field(0, ge=0, description="반복 섹션 인덱스 (default 0)")
    value: dict[str, Any] = Field(..., description='응답 데이터 ({"value": ...})')


class ValuesUpsertRequest(BaseModel):
    values: list[ValueItem] = Field(..., description="저장할 value 목록")


# Response


class ValueResponse(BaseModel):
    id: str
    instance_id: str
    field_key: str
    group_index: int
    value: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ValuesResponse(BaseModel):
    values: list[ValueResponse]
