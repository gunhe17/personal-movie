# CreditOps — UoW 밖(AIGateway·Agent)에서 독립 세션으로 크레딧 연산.
# QuotaChecker.check + CreditDeductor.deduct 프로토콜 구현.
#
# check(사전 잔량 게이트)와 deduct(사후 차감) 사이는 비원자 — 동시 호출이 추정
# 잔량을 초과 소비할 수 있는 TOCTOU 갭은 알려진 수용(결정 D19, 2026-07-04:
# 갭 유지+문서화). 초과분도 deduct로 기록되므로 다음 check가 차단한다.
# 기간 정산은 여기서 하지 않는다 — 소비 직전 조율층 시임 소유(ai-calling.md).

from __future__ import annotations

from app.modules.llm.credit_balance.repository import CreditBalanceRepository
from app.modules.llm.credit_balance.services import (
    VerifyQuotaService,
    DeductCreditService,
)


class CreditOps:
    def __init__(
        self,
        session_factory,
    ):
        self._sf = session_factory

    async def check(
        self,
        center_id: str,
        purpose: str,
    ) -> None:
        async with self._sf() as session:
            repo = CreditBalanceRepository(session)
            svc = VerifyQuotaService(repo)
            await svc.execute(center_id, purpose)
            await session.commit()

    async def deduct(
        self,
        center_id: str,
        tokens_used: int,
    ) -> tuple[int, int]:
        async with self._sf() as session:
            repo = CreditBalanceRepository(session)
            svc = DeductCreditService(repo)
            # 호출 기록은 llm_calls가 정본이고 activity read가 해당 행을 노출한다.
            _atomic, rate, credits = await svc.execute(center_id, tokens_used)
            await session.commit()
            return rate, credits
