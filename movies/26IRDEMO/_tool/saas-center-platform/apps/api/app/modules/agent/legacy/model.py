"""agent_* 4테이블 묘비(legacy).

assistant 컷오버(2026-07-23)로 코드 바인딩 제거 — 기능 대체: conversations→assistant_conversations,
messages→assistant_turns(user_message·completion·events), runs→assistant_turns.events+llm_calls.
과거 행 보존 + 테이블 등록(migrations/env.py·init-schema.py·lifecycle.py)만을 위해 남긴다
(존치 판정 2026-07-27) — 읽기/쓰기 코드 없음. agent_intent_templates는 이미 drop(d4e1a9b7c2f3).
"""
from sqlalchemy import Boolean, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class AgentConversation(BaseModel):
    __tablename__ = "agent_conversations"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    display_plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    vars: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)

    __table_args__ = (
        Index("ix_agent_conversations_center_updated", "center_id", "updated_at"),
        Index("ix_agent_conversations_member", "member_id"),
    )


class AgentMessage(BaseModel):
    __tablename__ = "agent_messages"

    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "agent_conversations"})
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_message: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    message_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_messages_conversation_seq", "conversation_id", "sequence"),
    )


class AgentRun(BaseModel):
    __tablename__ = "agent_runs"

    conversation_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "agent_conversations"})
    agent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    run_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    input_data: Mapped[dict | None] = mapped_column("input_data", JSONB, nullable=True)
    output_data: Mapped[dict | None] = mapped_column("output_data", JSONB, nullable=True)
    llm_call_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "llm_calls"})
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    parallel_group: Mapped[str | None] = mapped_column(String(36), nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_runs_conversation_seq", "conversation_id", "sequence"),
    )


class AgentPrompt(BaseModel):
    __tablename__ = "agent_prompts"

    key: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("key", "version", name="uq_agent_prompts_key_version"),
        Index("ix_agent_prompts_key_active", "key", "is_active"),
    )
