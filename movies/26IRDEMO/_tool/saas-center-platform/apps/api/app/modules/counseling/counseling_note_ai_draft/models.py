from sqlalchemy import Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model


class CounselingNoteAiDraft(BaseModel):
    __tablename__ = "counseling_note_ai_drafts"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_sessions"})
    field_note_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "field_notes"})
    # 기록 실패를 삼키는 경로(ai_gateway._record_call)가 있어 nullable
    llm_call_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "llm_calls"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    template_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        Index("idx_note_ai_draft_session", "counseling_session_id"),
        Index("idx_note_ai_draft_field_note", "field_note_id"),
    )
