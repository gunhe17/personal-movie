from sqlalchemy import Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class FormValue(BaseModel):
    __tablename__ = "form_values"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "forms"})
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    group_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index(
            "uq_form_values_instance_field_group",
            "instance_id", "field_key", "group_index",
            unique=True,
        ),
        Index("ix_form_values_instance", "instance_id"),
        Index("ix_form_values_center", "center_id"),
    )
