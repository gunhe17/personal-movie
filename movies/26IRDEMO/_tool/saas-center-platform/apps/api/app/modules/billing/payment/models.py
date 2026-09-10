from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class PaymentMethod(str, Enum):
    CARD = "card"
    TRANSFER = "transfer"
    CASH = "cash"
    LEGACY = "legacy"  # payment_records 백필분 — 원본에 결제수단 없음


# #
# model

class Payment(BaseModel):
    __tablename__ = "payments"

    billable_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "billables"})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    receipt_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "idx_payments_billable",
            "billable_id",
            postgresql_where="deleted_at IS NULL",
        ),
    )
