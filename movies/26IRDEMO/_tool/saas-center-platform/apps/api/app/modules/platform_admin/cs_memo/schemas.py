import math
from datetime import datetime

from pydantic import BaseModel, Field

from .models import MemoType


# ── 요청 스키마 ──


class CSMemoCreate(BaseModel):
    title: str = Field(..., max_length=200, description="제목")
    content: str = Field(..., min_length=1, description="내용")
    memo_type: MemoType = Field(..., description="유형")
    center_id: str | None = Field(default=None, description="관련 센터 ID")


class CSMemoUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200, description="제목")
    content: str | None = Field(default=None, min_length=1, description="내용")
    memo_type: MemoType | None = Field(default=None, description="유형")
    center_id: str | None = Field(default=None, description="관련 센터 ID")


class CSMemoBulkDelete(BaseModel):
    memo_ids: list[str] = Field(..., min_length=1, description="삭제할 메모 ID 목록")


# ── 응답 스키마 ──


class CSMemoSummary(BaseModel):
    id: str
    title: str
    memo_type: MemoType
    center_id: str | None = None
    center_name: str | None = None
    created_by: str
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CSMemoDetailResponse(BaseModel):
    id: str
    title: str
    content: str
    memo_type: MemoType
    center_id: str | None = None
    center_name: str | None = None
    created_by: str
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CSMemoListResponse(BaseModel):
    items: list[CSMemoSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[CSMemoSummary],
        total: int,
        page: int,
        size: int,
    ) -> "CSMemoListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


class CSMemoBulkDeleteResponse(BaseModel):
    detail: str
    deleted_count: int
