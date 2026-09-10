from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class MessageType(str, Enum):
    ALARMTALK = "alarmtalk"
    SMS = "sms"
    LMS = "lms"


class MessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


# #
# model

class MessageLog(BaseModel):
    __tablename__ = "message_logs"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    send_link_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "assessment_send_links"})
    send_result_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "assessment_send_results"})
    form_send_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "form_sends"})
    message_type: Mapped[MessageType] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[MessageStatus] = mapped_column(String(20), nullable=False, index=True, default=MessageStatus.PENDING)
    template_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    lgu_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True, index=True)
    recipient: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, index=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_center_status", "center_id", "status"),
        Index("idx_center_type", "center_id", "message_type"),
        Index("idx_status_scheduled", "status", "scheduled_at"),
    )
