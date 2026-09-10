from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class LlmCallRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str | None = None
    center_id: str | None = None
    source_type: str = "agent"
    source_id: str | None = None
    member_id: str | None = None
    model: str | None = None
    purpose: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    credits_charged: int | None = None
    audio_duration_seconds: float | None = None
    latency_ms: float | None = None
    error_message: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime
