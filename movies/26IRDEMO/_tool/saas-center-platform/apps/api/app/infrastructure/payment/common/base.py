"""PaymentClient — PG 결제 어댑터 계약 (Protocol).

건별결제(승인/조회/취소)만 규정. 빌링키(자동결제)는 계약 밖.
응답은 PG 원본 dict 그대로 — 정규화는 소비처(subscription) 책임.
"""
from __future__ import annotations

from typing import Protocol


class PaymentClient(Protocol):
    async def confirm_payment(
        self,
        payment_key: str,
        order_id: str,
        amount: int,
    ) -> dict: ...

    async def get_payment(self, payment_key: str) -> dict: ...

    async def cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str,
    ) -> dict: ...
