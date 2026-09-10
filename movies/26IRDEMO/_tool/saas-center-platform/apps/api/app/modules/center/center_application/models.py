from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CenterApplicationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# #
# model

class CenterApplication(BaseModel):
    __tablename__ = "center_applications"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    reviewed_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_accounts"})
    status: Mapped[str] = mapped_column(String(20), default=CenterApplicationStatus.PENDING, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    representative_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    business_registration_number: Mapped[str | None] = mapped_column(String(12), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
