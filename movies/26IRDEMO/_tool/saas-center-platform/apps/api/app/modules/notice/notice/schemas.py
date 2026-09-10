import math
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class NoticeCategory(str, Enum):
    MAINTENANCE = "maintenance"
    UPDATE = "update"
    ANNOUNCEMENT = "announcement"


class AttachmentItem(BaseModel):
    url: str = Field(..., description="공개 URL")
    path: str = Field(..., description="저장소 경로")
    name: str = Field(..., description="원본 파일명")
    size: int = Field(..., description="파일 크기 (bytes)")
    content_type: str = Field(..., description="MIME 타입")


# ── 요청 스키마 ──


class NoticeCreate(BaseModel):
    title: str = Field(..., max_length=200, description="제목")
    content: str = Field(..., min_length=1, description="내용")
    category: NoticeCategory = Field(..., description="유형")
    is_published: bool = Field(default=False, description="즉시 게시 여부")
    is_pinned: bool = Field(default=False, description="상단 고정 여부")
    attachments: list[AttachmentItem] | None = Field(default=None, max_length=5, description="첨부파일 (최대 5개)")


class NoticeUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200, description="제목")
    content: str | None = Field(default=None, min_length=1, description="내용")
    category: NoticeCategory | None = Field(default=None, description="유형")
    is_published: bool | None = Field(default=None, description="게시 여부")
    is_pinned: bool | None = Field(default=None, description="상단 고정 여부")
    attachments: list[AttachmentItem] | None = Field(default=None, max_length=5, description="첨부파일 (최대 5개)")


# ── 응답 스키마 ──


class NoticeSummary(BaseModel):
    id: str
    title: str
    category: NoticeCategory
    is_published: bool
    is_pinned: bool
    is_read: bool = False
    published_at: datetime | None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoticeSiblingItem(BaseModel):
    id: str
    title: str

    model_config = {"from_attributes": True}


class NoticeSiblings(BaseModel):
    prev: NoticeSiblingItem | None = None
    next: NoticeSiblingItem | None = None


class NoticeDetailResponse(BaseModel):
    id: str
    title: str
    content: str
    category: NoticeCategory
    is_published: bool
    is_pinned: bool
    published_at: datetime | None
    created_by: str
    created_by_name: str | None = None
    attachments: list[AttachmentItem] | None = None
    siblings: NoticeSiblings = Field(default_factory=NoticeSiblings)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoticeListResponse(BaseModel):
    items: list[NoticeSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[NoticeSummary],
        total: int,
        page: int,
        size: int,
    ) -> "NoticeListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
