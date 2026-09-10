from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class ScheduleType(str, Enum):
    ASSESSMENT = "assessment"
    COUNSELING = "counseling"
    MEETING = "meeting"
    BLOCK = "block"


# #
# model

class Schedule(BaseModel):
    __tablename__ = "schedules"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    member_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "members"})
    room_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "rooms"})
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_schedules_center_time", "center_id", "start"),
        Index("ix_schedules_center_type", "center_id", "schedule_type"),
        Index("ix_schedules_center_room", "center_id", "room_id"),
        Index("ix_schedules_center_member", "center_id", "member_id"),
    )
