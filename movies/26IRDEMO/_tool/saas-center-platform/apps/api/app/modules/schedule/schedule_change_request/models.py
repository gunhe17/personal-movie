from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ScheduleChangeRequest(BaseModel):
    __tablename__ = "schedule_change_requests"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    schedule_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "schedules"})
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "persons"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    decided_by_member_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    # 요청 시점 스냅샷 — 승인 화면에서 "기존 → 변경" 대비에 쓰고, 그 사이 일정이 또 바뀌었는지 판별한다
    current_start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    current_end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    requested_start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    requested_end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_schedule_change_requests_center_status", "center_id", "status"),
        Index(
            "uq_schedule_change_request_pending",
            "schedule_id",
            unique=True,
            postgresql_where=text("status = 'pending' AND deleted_at IS NULL"),
        ),
    )
