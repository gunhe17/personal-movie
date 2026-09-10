from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CenterVoucher(BaseModel):
    __tablename__ = "center_vouchers"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    catalog_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "vouchers"})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    default_total_sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unit_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "uq_center_vouchers_center_catalog",
            "center_id",
            "catalog_id",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_center_vouchers_center_active",
            "center_id",
            "is_active",
            postgresql_where="deleted_at IS NULL",
        ),
    )
