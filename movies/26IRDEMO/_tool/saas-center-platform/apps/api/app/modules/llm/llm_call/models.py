from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class LlmCall(BaseModel):
    __tablename__ = "llm_calls"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    member_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "members"})
    trace_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_type_field": "source_type"})
    source_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="agent", server_default="agent", index=True,
    )
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_per_credit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    credits_charged: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
