from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class NoteShareStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class NoteShareAudience(str, Enum):
    GUARDIAN = "guardian"
    SELF = "self"


# #
# model


class CounselingNoteShare(BaseModel):
    # 상담 일지(임상 원문)를 보호자·본인이 읽을 톤으로 옮긴 공유문.
    # published 로 전환된 것만 내담자 앱에 노출된다(G3 명시 가시성 플래그).
    __tablename__ = "counseling_note_shares"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_sessions"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    counseling_note_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "counseling_notes"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    # 기록 실패를 삼키는 경로(ai_gateway._record_call)가 있어 nullable
    llm_call_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "llm_calls"})
    audience: Mapped[str] = mapped_column(String(20), nullable=False, default=NoteShareAudience.GUARDIAN)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=NoteShareStatus.DRAFT, index=True)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    __table_args__ = (
        Index(
            "uq_note_share_session_client",
            "counseling_session_id",
            "client_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_note_share_session", "counseling_session_id"),
        Index("idx_note_share_client", "client_id"),
    )
