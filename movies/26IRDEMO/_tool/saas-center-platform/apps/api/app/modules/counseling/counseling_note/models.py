from sqlalchemy import String, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CounselingNote(BaseModel):
    __tablename__ = "counseling_notes"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_sessions"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        Index(
            "uq_counseling_note_session_client",
            "counseling_session_id",
            "client_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_note_session", "counseling_session_id"),
        Index("idx_note_client", "client_id"),
        Index("idx_note_author", "author_id"),
    )
