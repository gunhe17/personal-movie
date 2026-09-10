from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Notice(BaseModel):
    __tablename__ = "notices"

    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index(
            "idx_notices_published",
            "is_published",
            "is_pinned",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
    )
