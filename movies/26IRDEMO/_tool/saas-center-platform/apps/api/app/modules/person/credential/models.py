from enum import Enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CredentialStatus(str, Enum):
    UNVERIFIED = "unverified"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class CredentialType(str, Enum):
    EDUCATION = "education"
    CAREER = "career"
    CERTIFICATION = "certification"


# #
# model

class PersonCredential(BaseModel):
    __tablename__ = "person_credentials"

    person_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "persons"})
    reviewed_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_accounts"})
    credential_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CredentialStatus.UNVERIFIED, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    organization: Mapped[str] = mapped_column(String(200), nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attachment_content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    attachment_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PersonCredential(id={self.id}, credential_type={self.credential_type}, title={self.title})>"
