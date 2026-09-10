from sqlalchemy import Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class FormSend(BaseModel):
    __tablename__ = "form_sends"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    form_template_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "form_templates"})
    recipients: Mapped[list] = mapped_column(JSONB, nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="sms")

    __table_args__ = (
        Index("ix_form_sends_center_template", "center_id", "form_template_id"),
    )
