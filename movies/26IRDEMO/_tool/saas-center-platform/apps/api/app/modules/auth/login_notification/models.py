from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class LoginNotification(BaseModel):
    __tablename__ = "login_notifications"

    account_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "accounts"})
    device_info: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    login_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_new_device: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
