"""LguMessagingClient — LGU+ 채널(알림톡/SMS) 디스패치 합성. MessagingClient 구현체.

channel 인자로 알림톡/SMS 어댑터에 위임 — 소비처는 이 client 하나만 의존.
"""
from __future__ import annotations

from datetime import datetime

from app.infrastructure.messaging.lgu.alarmtalk import AlarmTalkService
from app.infrastructure.messaging.lgu.sms import SMSService


class LguMessagingClient:
    def __init__(self, alarmtalk: AlarmTalkService, sms: SMSService):
        self._alarmtalk = alarmtalk
        self._sms = sms

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
        if channel == "alarmtalk":
            return await self._alarmtalk.send_message(
                recipient=recipient,
                message=message,
                template_code=template_code,
                scheduled_at=scheduled_at,
            )
        return await self._sms.send_message(
            recipient=recipient,
            message=message,
            title=title,
            scheduled_at=scheduled_at,
        )
