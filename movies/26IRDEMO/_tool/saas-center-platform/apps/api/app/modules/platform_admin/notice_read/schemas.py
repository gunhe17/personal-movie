from datetime import datetime

from pydantic import BaseModel


class NoticeReadCenterSummary(BaseModel):
    center_id: str
    center_name: str
    is_read: bool
    first_read_at: datetime | None
    read_count: int
    member_count: int


class NoticeReadStatusResponse(BaseModel):
    total_centers: int
    read_centers: int
    unread_centers: int
    last_notified_at: datetime | None = None
    centers: list[NoticeReadCenterSummary]
    page: int
    size: int
    pages: int


class NoticeReadMemberDetail(BaseModel):
    member_id: str
    name: str
    role_name: str
    read_at: datetime | None


class NoticeReadCenterDetailResponse(BaseModel):
    center_id: str
    center_name: str
    members: list[NoticeReadMemberDetail]
