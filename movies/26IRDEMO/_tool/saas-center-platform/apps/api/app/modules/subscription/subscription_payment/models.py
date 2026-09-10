from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class SubscriptionPayment(BaseModel):
    __tablename__ = "subscription_payments"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    subscription_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "subscriptions"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    plan: Mapped[str] = mapped_column(String(20), nullable=False)
    toss_order_id: Mapped[str] = mapped_column(String(64), nullable=False)
    toss_payment_key: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    method: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    failed_reason: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        Index(
            "ix_subscription_payments_order_id",
            "toss_order_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_subscription_payments_center",
            "center_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
