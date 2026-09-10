"""알림 Schemas (Request/Response DTOs)"""
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    link_path: str | None = None
    actor_member_id: str | None = None
    read_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    size: int
    pages: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadResponse(BaseModel):
    updated: int
