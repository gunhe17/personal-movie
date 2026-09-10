"""토스페이먼츠 REST API 어댑터.

건별결제(일반결제) 전용. 빌링키(자동결제)는 미지원.
https://docs.tosspayments.com/reference
"""
from __future__ import annotations

import base64

import httpx

from app.core.logger import get_logger
from app.infrastructure.payment.toss.exception import TossPaymentError

logger = get_logger(__name__)


class TossPaymentClient:
    def __init__(
        self,
        *,
        secret_key: str,
        api_url: str = "https://api.tosspayments.com/v1",
    ):
        self._api_url = api_url
        # Basic auth: base64({secretKey}:)
        encoded = base64.b64encode(f"{secret_key}:".encode()).decode()
        self._headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    async def confirm_payment(
        self,
        payment_key: str,
        order_id: str,
        amount: int,
    ) -> dict:
        # 금액 위변조 방지: 프론트 결제 완료 후 서버가 amount를 재검증하며 최종 승인
        url = f"{self._api_url}/payments/confirm"
        body = {
            "paymentKey": payment_key,
            "orderId": order_id,
            "amount": amount,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers, json=body)

        return self._handle_response(resp)

    async def get_payment(self, payment_key: str) -> dict:
        url = f"{self._api_url}/payments/{payment_key}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=self._headers)

        return self._handle_response(resp)

    async def cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str,
    ) -> dict:
        # 전액 취소만 지원 (부분 취소 미사용)
        url = f"{self._api_url}/payments/{payment_key}/cancel"
        body = {"cancelReason": cancel_reason}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers, json=body)

        return self._handle_response(resp)

    def _handle_response(self, resp: httpx.Response) -> dict:
        data = resp.json()

        if resp.is_success:
            return data

        code = data.get("code", "UNKNOWN")
        message = data.get("message", "알 수 없는 오류")
        logger.error(
            "Toss API error: status=%d code=%s message=%s",
            resp.status_code, code, message,
        )
        raise TossPaymentError(code=code, message=message, status=resp.status_code)
