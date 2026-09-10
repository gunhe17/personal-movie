from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class SubscriptionHistory(BaseModel):
    __tablename__ = "subscription_history"

    subscription_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "subscriptions"})
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    from_plan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_plan: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)

    __table_args__ = (
        Index("ix_subscription_history_sub_id", "subscription_id"),
    )
