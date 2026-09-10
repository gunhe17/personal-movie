import math
from datetime import datetime

from pydantic import BaseModel

from app.modules.notice.notice.schemas import NoticeCategory


class AdminNoticeSummary(BaseModel):
    id: str
    title: str
    category: NoticeCategory
    is_published: bool
    is_pinned: bool
    read_count: int = 0
    target_read_count: int = 0
    published_at: datetime | None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminNoticeListResponse(BaseModel):
    items: list[AdminNoticeSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminNoticeSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminNoticeListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


class NotifyNoticeResponse(BaseModel):
    message: str
    target_member_count: int


class NotifyNoticeWrappedResponse(BaseModel):
    success: bool
    data: NotifyNoticeResponse


class AttachmentUploadResponse(BaseModel):
    url: str
    path: str
    name: str
    size: int
    content_type: str
