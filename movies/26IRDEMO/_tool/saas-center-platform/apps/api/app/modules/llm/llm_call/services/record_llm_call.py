from typing import Any

from app.core.logger import get_logger
from app.modules.llm.credit_balance.plan_config import FREE_PURPOSES
from app.modules.llm.credit_balance.repository import CreditBalanceRepository
from app.modules.llm.credit_balance.services import DeductCreditService
from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository
from app.modules.llm.credit_rate_config.services.get_tokens_per_credit import (
    GetTokensPerCreditService,
)
from ..models import LlmCall
from ..repository import LlmCallRepository
from .create_llm_call import CreateLlmCallService

logger = get_logger(__name__)


class RecordLlmCallService:
    def __init__(
        self,
        llm_call_repo: LlmCallRepository,
        credit_balance_repo: CreditBalanceRepository,
        credit_rate_repo: CreditRateConfigRepository,
    ):
        self._llm_call_repo = llm_call_repo
        self._credit_balance_repo = credit_balance_repo
        self._credit_rate_repo = credit_rate_repo

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
    ) -> LlmCall:
        current_rate = await GetTokensPerCreditService(self._credit_rate_repo).execute()

        is_free = purpose in FREE_PURPOSES if purpose else True
        total_tokens = input_tokens + output_tokens
        credits_charged = 0
        if center_id and not is_free and total_tokens > 0:
            try:
                _deduct_atomic, _, credits_charged = await DeductCreditService(
                    self._credit_balance_repo
                ).execute(
                    center_id=center_id,
                    tokens_used=total_tokens,
                    rate=current_rate,
                )
            except Exception as e:
                logger.warning(f"Credit deduction failed: {e}")

        return await CreateLlmCallService(self._llm_call_repo).execute(
            session_id=session_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            error_message=error_message,
            meta=meta,
            purpose=purpose,
            center_id=center_id,
            source_type=source_type,
            source_id=source_id,
            audio_duration_seconds=audio_duration_seconds,
            member_id=member_id,
            tokens_per_credit=current_rate,
            credits_charged=credits_charged,
        )
