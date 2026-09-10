from datetime import datetime
from enum import Enum

from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class InquiryType(str, Enum):
    GENERAL = "general"
    TECHNICAL = "technical"
    FEATURE_REQUEST = "feature_request"
    OTHER = "other"


class InquiryStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


# #
# model

class Inquiry(BaseModel):
    __tablename__ = "inquiries"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    answered_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_accounts"})
    inquiry_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="유형: general/technical/feature_request/other"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", comment="상태: pending/in_progress/resolved/closed"
    )
    center_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="센터명 비정규화"
    )
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    sender_email: Mapped[str] = mapped_column(String(200), nullable=False)
    answered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index(
            "idx_inquiries_status",
            "status",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_inquiries_center",
            "center_id",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
    )
