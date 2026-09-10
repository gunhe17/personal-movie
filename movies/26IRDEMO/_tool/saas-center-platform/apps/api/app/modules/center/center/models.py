from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Center(BaseModel):
    __tablename__ = "centers"

    code: Mapped[str] = mapped_column(String(6), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    representative_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    address: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    image_urls: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True, default=None)
    business_registration_number: Mapped[str | None] = mapped_column(String(12), nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        Index("uq_centers_code_active", "code", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )
