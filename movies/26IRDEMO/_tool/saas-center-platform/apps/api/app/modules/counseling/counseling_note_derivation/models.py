from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model


class CounselingNoteDerivation(BaseModel):
    __tablename__ = "counseling_note_derivations"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_note_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_notes"})
    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_sessions"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    # 기록 실패를 삼키는 경로(ai_gateway._record_call)가 있어 nullable
    llm_call_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "llm_calls"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    published_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    # LLM 원본 — llm_calls는 토큰·모델만 남기고 응답 본문을 보관하지 않는다
    generated_content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index(
            "uq_note_derivation_published",
            "counseling_note_id",
            "kind",
            unique=True,
            postgresql_where=text("status = 'published' AND deleted_at IS NULL"),
        ),
        Index("idx_note_derivation_note", "counseling_note_id"),
        Index("idx_note_derivation_session", "counseling_session_id"),
    )
