from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class BillableItemType(str, Enum):
    SERVICE = "service"
    PRODUCT = "product"
    PACKAGE = "package"


# #
# model

class BillableItem(BaseModel):
    __tablename__ = "billable_items"

    billable_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "billables"})
    item_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_type_field": "item_type"})
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    related_case_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    related_session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    client_voucher_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "client_vouchers"})
    price_list_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "price_lists"})
    related_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    subsidy_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    provided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "idx_billable_items_billable",
            "billable_id",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_billable_items_client_voucher",
            "client_voucher_id",
            postgresql_where="deleted_at IS NULL AND client_voucher_id IS NOT NULL",
        ),
    )
