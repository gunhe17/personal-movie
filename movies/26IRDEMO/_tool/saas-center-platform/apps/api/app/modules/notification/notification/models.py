from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Notification(BaseModel):
    __tablename__ = "notifications"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    recipient_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    event_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index("ix_notifications_recipient", "center_id", "recipient_id", "is_read", "created_at"),
        # 앱 알림함은 센터를 가로질러 읽는다 — 위 인덱스는 center_id 선두라 못 쓴다
        Index("ix_notifications_recipient_only", "recipient_id", "is_read", "created_at"),
        Index("ix_notifications_event_ref", "event_ref", "recipient_id", unique=True),
    )
