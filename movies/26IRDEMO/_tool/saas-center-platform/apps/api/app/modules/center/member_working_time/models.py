from datetime import time

from sqlalchemy import String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class MemberWorkingTime(BaseModel):
    __tablename__ = "member_working_times"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    weekday: Mapped[str] = mapped_column(String(3), nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
