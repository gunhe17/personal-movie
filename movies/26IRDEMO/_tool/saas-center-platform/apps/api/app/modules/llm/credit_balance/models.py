from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CreditBalance(BaseModel):
    __tablename__ = "credit_balances"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    plan_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pro")
    credit_limit: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1500")
    credit_used: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    __table_args__ = (
        Index(
            "uq_credit_balance_active",
            "center_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
