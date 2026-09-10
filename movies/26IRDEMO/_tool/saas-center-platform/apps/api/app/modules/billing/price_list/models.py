from enum import Enum

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class ServiceType(str, Enum):
    COUNSELING = "counseling"
    ASSESSMENT = "assessment"
    PACKAGE = "package"


# #
# model

class PriceList(BaseModel):
    __tablename__ = "price_lists"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None, info={"reference_type_field": "service_type", "reference_tables": {"counseling": "programs", "assessment": "assessments", "package": "assessment_sets"}})
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    service_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual", server_default="manual")
    service_name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "idx_price_lists_center_active_type",
            "center_id",
            "is_active",
            "service_type",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_price_lists_center_name",
            "center_id",
            "service_name",
            postgresql_where="deleted_at IS NULL",
        ),
    )
