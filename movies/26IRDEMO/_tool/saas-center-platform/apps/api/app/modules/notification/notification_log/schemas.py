from datetime import datetime
from typing import Any

from pydantic import BaseModel


class NotificationLogResponse(BaseModel):
    id: str
    notification_id: str | None
    center_id: str
    recipient_id: str
    channel: str
    status: str
    error_message: str | None
    sent_at: datetime | None
    request_payload: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}
