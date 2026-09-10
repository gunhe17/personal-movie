from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class NotificationLog(BaseModel):
    __tablename__ = "notification_logs"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    notification_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "notifications"})
    recipient_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index("ix_notification_logs_notification", "notification_id"),
        Index("ix_notification_logs_recipient", "center_id", "recipient_id", "created_at"),
        Index("ix_notification_logs_status", "status", "created_at"),
    )
