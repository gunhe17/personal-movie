from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class ParticipantType(str, Enum):
    CLIENT = "client"
    COUNSELOR = "counselor"


# absent=사전 통보 결석 / no_show=무단 결석(청구 정책상 구분) / excused=사유 결석
class AttendanceStatus(str, Enum):
    SCHEDULED = "scheduled"
    ATTENDED = "attended"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"
    NO_SHOW = "no_show"


# #
# model


class CounselingSessionParticipant(BaseModel):
    __tablename__ = "counseling_session_participants"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "counseling_sessions"})
    participant_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "participant_type", "reference_tables": {"client": "clients", "counselor": "members"}})
    participant_type: Mapped[str] = mapped_column(String(20), nullable=False)
    attendance_status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    attended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    is_consumed: Mapped[bool] = mapped_column(nullable=False, default=False, index=True)
    memo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "participant_type",
            "participant_id",
            name="uq_counseling_session_participant"
        ),
        Index("ix_counseling_session_participants_center_id", "center_id"),
        Index("ix_counseling_session_participants_session", "session_id"),
        Index("ix_counseling_session_participants_participant", "participant_type", "participant_id"),
        Index("ix_counseling_session_participants_attendance", "attendance_status"),
    )
