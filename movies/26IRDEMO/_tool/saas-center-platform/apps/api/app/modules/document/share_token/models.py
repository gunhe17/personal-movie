from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ShareToken(BaseModel):
    __tablename__ = "share_tokens"

    document_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "documents"})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    max_downloads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
