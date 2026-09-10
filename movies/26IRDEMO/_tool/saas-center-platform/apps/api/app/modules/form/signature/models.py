from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class FormSignature(BaseModel):
    __tablename__ = "form_signatures"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "forms"})
    field_id: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_type: Mapped[str] = mapped_column(String(20), nullable=False, default="base64")
    signer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signer_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    signature_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_form_signatures_instance_field", "instance_id", "field_id"),
        Index("ix_form_signatures_center", "center_id"),
    )
