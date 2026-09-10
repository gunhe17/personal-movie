from datetime import date

from sqlalchemy import Date, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ClientVoucher(BaseModel):
    __tablename__ = "client_vouchers"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    center_voucher_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "center_vouchers"})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remaining_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index(
            "idx_client_vouchers_client",
            "client_id",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_client_vouchers_center",
            "center_id",
            postgresql_where="deleted_at IS NULL",
        ),
    )
