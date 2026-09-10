from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class LedgerEntryType(str, Enum):
    OBSERVATION = "observation"
    TEACHER_NOTE = "teacher_note"
    MILESTONE = "milestone"
    PAPER_DOC = "paper_doc"
    CALL_LOG = "call_log"


class LedgerMood(str, Enum):
    EXCITED = "excited"
    CALM = "calm"
    NEUTRAL = "neutral"
    SAD = "sad"
    ANGRY = "angry"
    ANXIOUS = "anxious"


# #
# model

class LedgerEntry(BaseModel):
    __tablename__ = "ledger_entries"
    __table_args__ = (
        # 재전송 멱등 앵커 — tombstone(내용만 파기, 행 잔존)도 앵커로 남아야 하므로
        # partial index가 아니라 전역 unique다(설계.md §15-1·§15-5).
        Index("uq_ledger_entries_client_key", "client_key", unique=True),
        Index("ix_ledger_entries_profile_occurred", "profile_id", "occurred_at"),
    )

    profile_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, info={"reference_table_name": "profiles"}
    )
    author_person_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, info={"reference_table_name": "persons"}
    )
    entry_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=LedgerEntryType.OBSERVATION.value
    )
    mood: Mapped[str | None] = mapped_column(String(20), nullable=True)
    situation_tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    client_key: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    bookmarked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    private_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
