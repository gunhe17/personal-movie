from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class VoucherFormTemplate(BaseModel):
    __tablename__ = "voucher_form_templates"

    voucher_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "vouchers"})
    form_template_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "form_templates"})
    kind: Mapped[str] = mapped_column(String(20), nullable=False, server_default="기타")

    __table_args__ = (
        # 삭제 안 된 링크만 유일 — 전역 unique 면 soft-delete 후 재링크가 막힌다
        Index(
            "uq_voucher_form_template",
            "voucher_id",
            "form_template_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
