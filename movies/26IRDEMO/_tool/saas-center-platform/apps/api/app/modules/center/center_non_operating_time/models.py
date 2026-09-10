from datetime import datetime, time

from sqlalchemy import Boolean, String, Integer, Time, DateTime, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class NonOperatingTime(BaseModel):
    __tablename__ = "non_operating_times"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "accounts"})
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weekday: Mapped[str | None] = mapped_column(String(3), nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_system_registered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
