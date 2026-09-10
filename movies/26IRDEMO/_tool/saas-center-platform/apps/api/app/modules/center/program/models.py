from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Program(BaseModel):
    __tablename__ = "programs"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    program_type: Mapped[str] = mapped_column(String(20), nullable=False, default="INDIVIDUAL")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
