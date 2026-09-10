"""DryRunMessagingClient — 실제로 보내지 않고 보낸 것처럼 답하는 발송 클라이언트.

자격증명이 없는 로컬에서 LGU+ 호출은 항상 실패하고, 그 실패가 SendMessageService에서
MessageStatus.FAILED로 굳어 화면에 "전송이 실패했어요" 경고로 나온다. 개발·영상 촬영에서는
그 경고가 흐름을 끊을 뿐 확인할 것이 없다.

settings.MESSAGING_DRY_RUN 이 True일 때만 factory가 이것을 만든다. 운영은 항상 False다.
반환 모양은 LguMessagingClient와 같다 — 소비처(SendMessageService)는 차이를 모른다.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger

logger = get_logger(__name__)


class DryRunMessagingClient:
    async def send_message(
        self,
        *,
        channel: str,
        recipient: str,
        message: str,
        template_code: str | None = None,
        title: str | None = None,
        scheduled_at: datetime | None = None,
    ) -> dict:
        logger.info(f"[dry-run] {channel} → {recipient} ({len(message)}자) 실제 발송 없음")
        return {"message_id": f"dryrun-{uuid.uuid4().hex[:12]}", "sent_at": utc_now()}
