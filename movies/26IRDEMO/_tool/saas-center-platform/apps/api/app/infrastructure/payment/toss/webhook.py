from __future__ import annotations

import base64
import hmac

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def verify_toss_webhook(request: Request) -> None:
    # 미설정=통과는 서명 무검증 수용과 같다 — 명시 실패(503)로 차단 (P1 결정 클래스, f3f6e143f 동형)
    if not settings.TOSS_WEBHOOK_SECRET:
        logger.error("TOSS_WEBHOOK_SECRET 미설정 — 웹훅 수신 불가(명시 실패)")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook verification is not configured",
        )

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing webhook authorization",
        )

    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        # 토스 Basic auth 형식: {webhookSecret}:
        webhook_secret = decoded.rstrip(":")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook authorization format",
        )

    if not hmac.compare_digest(webhook_secret, settings.TOSS_WEBHOOK_SECRET):
        logger.warning("토스 웹훅 시크릿 불일치")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )
