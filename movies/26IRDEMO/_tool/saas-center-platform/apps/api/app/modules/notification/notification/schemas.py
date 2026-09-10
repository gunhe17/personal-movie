from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel


class NotificationCategory(str, Enum):
    ASSESSMENT = "assessment"
    COUNSELING = "counseling"
    SYSTEM = "system"
    ALL = "*"  # 글로벌 설정용


class NotificationPriority(str, Enum):
    IMPORTANT = "important"  # 인앱 + 외부채널 (알림톡, Push)
    NORMAL = "normal"        # 인앱만


class NotificationResponse(BaseModel):
    id: str
    center_id: str
    recipient_id: str
    category: NotificationCategory
    event_type: str
    priority: NotificationPriority
    title: str
    body: str
    data: dict[str, Any] | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationSummary(BaseModel):
    id: str
    category: NotificationCategory
    event_type: str
    priority: NotificationPriority
    title: str
    body: str
    data: dict[str, Any] | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationSummary]
    total: int
    page: int
    size: int
    pages: int


class UnreadCountResponse(BaseModel):
    count: int


class MarkAllReadResponse(BaseModel):
    updated_count: int
