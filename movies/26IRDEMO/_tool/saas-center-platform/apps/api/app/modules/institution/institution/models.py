from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Institution(BaseModel):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    address: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
