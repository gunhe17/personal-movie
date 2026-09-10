from datetime import time

from sqlalchemy import String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class OperatingTime(BaseModel):
    __tablename__ = "operating_times"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    weekday: Mapped[str] = mapped_column(String(3), nullable=False)
    open_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    close_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
