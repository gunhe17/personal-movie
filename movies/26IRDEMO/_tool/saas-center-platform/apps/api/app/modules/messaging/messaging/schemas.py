from datetime import datetime

from pydantic import BaseModel


class MessageLogSummary(BaseModel):
    id: str
    message_type: str
    recipient: str
    status: str
    lgu_message_id: str | None = None
    error_message: str | None = None
    sent_at: datetime | None = None
    failed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
