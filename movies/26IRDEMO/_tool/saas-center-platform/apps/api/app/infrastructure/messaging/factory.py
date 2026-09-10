from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.infrastructure.messaging.common.base import MessagingClient
from app.infrastructure.messaging.lgu.client import LguMessagingClient
from app.infrastructure.messaging.firebase.client import FirebaseService
from app.infrastructure.messaging.lgu.alarmtalk import AlarmTalkService
from app.infrastructure.messaging.lgu.transport import LGUBaseClient
from app.infrastructure.messaging.lgu.sms import SMSService
from app.infrastructure.messaging.dryrun import DryRunMessagingClient


@lru_cache
def get_lgu_client() -> LGUBaseClient:
    return LGUBaseClient(
        api_url=settings.LGU_API_URL,
        api_key=settings.KAKAO_ALARM_TALK_API_KEY,
        api_pwd=settings.KAKAO_ALARM_TALK_API_PWD,
        auth_num=settings.KAKAO_ALARM_TALK_AUTH_NUM,
    )


@lru_cache
def get_alarmtalk_service() -> AlarmTalkService:
    return AlarmTalkService(
        lgu_client=get_lgu_client(),
        sender_key=settings.KAKAO_ALARM_TALK_SENDER_KEY,
        callback=settings.KAKAO_ALARM_TALK_CALLBACK,
    )


@lru_cache
def get_sms_service() -> SMSService:
    return SMSService(
        lgu_client=get_lgu_client(),
        callback=settings.KAKAO_ALARM_TALK_CALLBACK,
    )


@lru_cache
def get_firebase_service() -> FirebaseService | None:
    if not settings.FIREBASE_ENABLED:
        return None
    return FirebaseService(
        project_id=settings.FIREBASE_PROJECT_ID,
        private_key_id=settings.FIREBASE_PRIVATE_KEY_ID,
        private_key=settings.FIREBASE_PRIVATE_KEY,
        client_email=settings.FIREBASE_CLIENT_EMAIL,
    )


@lru_cache
def get_messaging_client() -> MessagingClient:
    # 자격증명이 없는 로컬에서는 발송이 무조건 실패한다 — 그 실패가 화면 흐름을 끊지 않도록
    # 드라이런이면 LGU+ 어댑터를 아예 만들지 않는다(잘못된 설정으로 실제 발송이 나갈 여지도 없앤다).
    if settings.MESSAGING_DRY_RUN:
        return DryRunMessagingClient()
    return LguMessagingClient(get_alarmtalk_service(), get_sms_service())
