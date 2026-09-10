from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CreditRateConfig(BaseModel):
    __tablename__ = "credit_rate_configs"

    changed_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_accounts"})
    tokens_per_credit: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "uq_credit_rate_active",
            "id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND effective_to IS NULL"),
        ),
    )
