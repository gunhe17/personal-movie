from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class AdminRefreshToken(BaseModel):
    __tablename__ = "admin_refresh_tokens"

    admin_account_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    parent_token_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_refresh_tokens"})
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    device_info: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
