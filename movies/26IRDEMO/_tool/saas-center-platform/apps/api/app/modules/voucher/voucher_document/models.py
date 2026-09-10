from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import INT4RANGE
from sqlalchemy.dialects.postgresql.ranges import Range
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class VoucherDocument(BaseModel):
    __tablename__ = "voucher_documents"

    voucher_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "vouchers"})
    global_document_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "global_documents"})
    page_range: Mapped[Range | None] = mapped_column(INT4RANGE, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "voucher_id", "global_document_id", name="uq_voucher_document"
        ),
        Index("ix_voucher_documents_voucher", "voucher_id"),
        Index("ix_voucher_documents_global_document", "global_document_id"),
    )
