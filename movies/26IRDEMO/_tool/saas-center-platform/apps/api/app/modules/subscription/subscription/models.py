from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Subscription(BaseModel):
    __tablename__ = "subscriptions"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    reserved_plan: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    quota_grace_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    reserved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    is_quota_exceeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index(
            "ix_subscriptions_center_active",
            "center_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
