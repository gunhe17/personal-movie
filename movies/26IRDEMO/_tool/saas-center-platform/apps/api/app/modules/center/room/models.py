from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Room(BaseModel):
    __tablename__ = "rooms"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    inactive_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
