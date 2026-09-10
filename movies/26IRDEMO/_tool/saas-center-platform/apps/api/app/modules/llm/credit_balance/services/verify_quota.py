from __future__ import annotations

from app.core.exceptions import InvalidOperationException, QuotaExceededException
from app.modules.llm.credit_balance.plan_config import (
    AIPurpose,
    FREE_PURPOSES,
    PURPOSE_ESTIMATED_CREDITS,
)
from app.modules.llm.credit_balance.repository import CreditBalanceRepository

_VALID_PURPOSES: frozenset[str] = frozenset(AIPurpose)


class VerifyQuotaService:
    def __init__(self, repo: CreditBalanceRepository):
        self.repo = repo

    async def execute(self, center_id: str, purpose: str) -> None:
        # 미등록 purpose 거부 — 오타/미등록 기능이 크레딧 체크를 우회하는 것을 방지
        if purpose and purpose not in _VALID_PURPOSES:
            raise InvalidOperationException(
                f"Unknown AI purpose: '{purpose}'. "
                "새 AI 기능을 추가하려면 AIPurpose Enum에 먼저 등록하세요."
            )

        if purpose in FREE_PURPOSES:
            return

        # 정산은 과금 소비 직전 조율층 시임이 이 호출 전에 수행(자체 tx 커밋 — ai-calling.md).
        # 유료 purpose인데 활성 balance 없으면 차단(fail-closed) — 모든 센터는 프로비저닝 시
        # balance를 받으므로, 없음 = Free/만료 전환분(지갑 삭제)이라 유료 소비를 막는다.
        row = await self.repo.find_active_by_center(center_id)
        if row is None:
            raise QuotaExceededException(
                "이번 달 AI 크레딧이 부족합니다. 관리자에게 문의하거나 직접 작성해주세요.",
            )

        remaining = row.credit_limit - row.credit_used
        estimated = PURPOSE_ESTIMATED_CREDITS.get(purpose, 1)
        if remaining < estimated:
            raise QuotaExceededException(
                "이번 달 AI 크레딧이 부족합니다. 관리자에게 문의하거나 직접 작성해주세요.",
            )
