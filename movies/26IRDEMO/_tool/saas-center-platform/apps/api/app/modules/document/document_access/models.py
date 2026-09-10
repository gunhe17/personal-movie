from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.models import BaseModel


# #
# model

class DocumentAccess(BaseModel):
    __tablename__ = "document_accesses"

    document_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "documents"})

    s3_version_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    account_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "accounts"})

    action: Mapped[str] = mapped_column(String(20), nullable=False)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    accessed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)

    __table_args__ = (
        Index("ix_document_accesses_document", "document_id", "accessed_at"),
        Index("ix_document_accesses_account", "account_id", "accessed_at"),
    )
