from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CenterNotePreference(BaseModel):
    __tablename__ = "center_note_preferences"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    default_template_type: Mapped[str] = mapped_column(String(30), nullable=False, default="default", server_default="default")

    __table_args__ = (
        Index(
            "uq_center_note_pref_center_active",
            "center_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
