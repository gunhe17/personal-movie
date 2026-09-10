from typing import Any

from ..models import LlmCall
from ..repository import LlmCallRepository


class CreateLlmCallService:
    def __init__(self, repo: LlmCallRepository) -> None:
        self.repo = repo

    async def execute(
        self,
        *,
        session_id: str | None = None,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float | None = None,
        error_message: str | None = None,
        meta: dict[str, Any] | None = None,
        purpose: str | None = None,
        center_id: str | None = None,
        source_type: str = "agent",
        source_id: str | None = None,
        audio_duration_seconds: float | None = None,
        member_id: str | None = None,
        tokens_per_credit: int | None = None,
        credits_charged: int = 0,
    ) -> LlmCall:
        # return (환율·차감 조율은 LlmCallFacade.add_llm_call — 여기는 기록만)
        return await self.repo.add(
            purpose=purpose,
            session_id=session_id,
            center_id=center_id,
            source_type=source_type,
            source_id=source_id,
            member_id=member_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            tokens_per_credit=tokens_per_credit,
            credits_charged=credits_charged,
            audio_duration_seconds=audio_duration_seconds,
            latency_ms=latency_ms,
            error_message=error_message,
            meta=meta,
        )
