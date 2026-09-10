"""AI Gateway Quota / Deductor 프로토콜.

QuotaChecker: AI 호출 전 잔량 검증.
CreditDeductor: AI 호출 후 크레딧 사후 차감.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class QuotaChecker(Protocol):
    """AI 호출 전 quota를 검증하는 프로토콜.

    한도 초과 시 QuotaExceededException을 raise.
    """

    async def check(self, center_id: str, purpose: str) -> None: ...


@runtime_checkable
class CreditDeductor(Protocol):
    async def deduct(self, center_id: str, tokens_used: int) -> None: ...


class NoOpQuotaChecker:
    async def check(
        self,
        center_id: str,
        purpose: str,
    ) -> None:
        pass
