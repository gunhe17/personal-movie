from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Event(BaseModel):
    __tablename__ = "events"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False, default="member", index=True)  # member | admin | machine | guest | agent(멤버가 AI 경유 수행 — actor_id는 member) — 감사 조회 파티션
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, index=True)
    attempts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
