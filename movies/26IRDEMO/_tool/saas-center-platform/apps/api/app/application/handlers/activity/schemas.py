from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ActivityChange(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    summary: str
    extra: dict[str, Any] | None


class ActivityLogResponse(BaseModel):
    id: str
    event_name: str
    center_id: str
    actor_id: str
    actor_name: str | None
    category: str
    action: str
    entity_type: str
    entity_id: str
    summary: str
    ip_address: str | None
    user_agent: str | None
    extra: dict[str, Any] | None
    changes: list[ActivityChange]
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    page: int
    size: int
    pages: int
