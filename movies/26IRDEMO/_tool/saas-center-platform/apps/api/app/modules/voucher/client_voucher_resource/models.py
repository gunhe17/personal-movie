from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ClientVoucherResource(BaseModel):
    __tablename__ = "client_voucher_resources"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_voucher_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "client_vouchers"})
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "resource_type", "reference_tables": {"form_instance": "forms", "pre_admission": "documents"}})
    resource_type: Mapped[str] = mapped_column(String(20), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "client_voucher_id", "resource_id", name="uq_client_voucher_resource"
        ),
        Index("ix_client_voucher_resources_voucher", "client_voucher_id"),
        Index("ix_client_voucher_resources_center", "center_id"),
        Index(
            "ix_client_voucher_resources_type", "client_voucher_id", "resource_type"
        ),
    )
