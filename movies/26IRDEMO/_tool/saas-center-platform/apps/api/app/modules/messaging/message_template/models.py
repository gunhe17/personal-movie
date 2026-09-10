from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class MessageTemplate(BaseModel):
    __tablename__ = "message_templates"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    template_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    variables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_msg_tpl_center_type", "center_id", "template_type"),
        Index(
            "uq_msg_tpl_center_type_default",
            "center_id",
            "template_type",
            unique=True,
            postgresql_where=text("is_default = true AND deleted_at IS NULL"),
        ),
    )
