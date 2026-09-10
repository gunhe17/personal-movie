from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class AssistantTurnStatus(str, Enum):
    RUNNING = "running"
    DONE = "done"
    PAUSED = "paused"
    ABANDONED = "abandoned"


# #
# model


class AssistantConversation(BaseModel):
    __tablename__ = "assistant_conversations"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(
        String(36), nullable=False, info={"reference_table_name": "members"}
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)

    __table_args__ = (
        Index(
            "ix_assistant_conversations_center_member",
            "center_id",
            "member_id",
            postgresql_where="deleted_at IS NULL",
        ),
    )


class AssistantTurn(BaseModel):
    __tablename__ = "assistant_turns"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        info={"reference_table_name": "assistant_conversations"},
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AssistantTurnStatus.RUNNING
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    events: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    completion: Mapped[str | None] = mapped_column(Text, nullable=True)
    bookmark: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index(
            "ix_assistant_turns_conversation_created",
            "conversation_id",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "ix_assistant_turns_center_status",
            "center_id",
            "status",
            postgresql_where="deleted_at IS NULL",
        ),
    )
