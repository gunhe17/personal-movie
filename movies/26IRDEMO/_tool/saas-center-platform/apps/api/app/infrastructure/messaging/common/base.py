"""MessagingClient — 문자/알림 발송 어댑터 계약 (Protocol).

채널(알림톡/SMS) 선택을 인자로 받아 단일 진입점으로 디스패치한다. 소비처는 채널별
어댑터를 따로 들지 않고 이 한 인터페이스만 의존한다. 반환 dict 스키마:
``message_id`` / ``status``("pending"|"sent"|"failed") / ``sent_at`` / ``scheduled_at``.
"""
from __future__ import annotations

from datetime import datetime
from typing import Protocol


class MessagingClient(Protocol):
    async def send_message(
        self,
        *,
        channel: str,  # "alarmtalk" | "sms"
        recipient: str,
        message: str,
        template_code: str | None = None,  # 알림톡 전용
        title: str | None = None,  # SMS/LMS 전용
        scheduled_at: datetime | None = None,
    ) -> dict: ...
