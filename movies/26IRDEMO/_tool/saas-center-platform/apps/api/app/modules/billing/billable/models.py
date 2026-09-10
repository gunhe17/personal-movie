from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class BillableStatus(str, Enum):
    ISSUED = "issued"
    PAID = "paid"


# #
# model

class Billable(BaseModel):
    __tablename__ = "billables"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="issued")
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    subsidy_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    paid_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unpaid_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    billable_date: Mapped[date] = mapped_column(Date, nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "idx_billables_center_client",
            "center_id",
            "client_id",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_billables_center_status",
            "center_id",
            "status",
            postgresql_where="deleted_at IS NULL",
        ),
    )
