from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.infrastructure.payment.common.base import PaymentClient
from app.infrastructure.payment.toss.client import TossPaymentClient


@lru_cache
def get_toss_client() -> PaymentClient:
    return TossPaymentClient(
        secret_key=settings.TOSS_SECRET_KEY,
        api_url=settings.TOSS_API_URL,
    )
