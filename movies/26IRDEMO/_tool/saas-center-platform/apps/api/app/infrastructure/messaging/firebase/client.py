"""FirebaseService — Push 발송 어댑터.

Expo Token(내담자 앱)은 Expo Push API, 그 외(웹·직원앱 FCM 토큰)는 Firebase Admin SDK 직접.
firebase_admin 초기화는 최초 1회만 수행. get_firebase_service는 FIREBASE_ENABLED=False면 None.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx

from app.core.logger import get_logger

logger = get_logger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@dataclass
class PushResult:
    success: bool
    message_id: str | None = None
    error: str | None = None
    invalid_token: bool = False  # 토큰 무효화 필요 여부


class FirebaseService:
    def __init__(
        self,
        project_id: str,
        private_key_id: str,
        private_key: str,
        client_email: str,
    ):
        self._initialized = False
        self._credentials = {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": private_key_id,
            "private_key": private_key.replace("\\n", "\n"),
            "client_email": client_email,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return

        import firebase_admin
        from firebase_admin import credentials

        # 이미 초기화된 앱이 있으면 재사용
        try:
            firebase_admin.get_app()
        except ValueError:
            cred = credentials.Certificate(self._credentials)
            firebase_admin.initialize_app(cred)

        self._initialized = True
        logger.info("Firebase Admin SDK initialized")

    async def send_push(
        self,
        token: str,
        title: str,
        body: str,
        data: dict | None = None,
        link: str | None = None,
        platform: str = "web",
        badge: int | None = None,
    ) -> PushResult:
        # Expo Token → Expo Push API. 플랫폼이 아니라 토큰 형태로 가른다 —
        # 안드로이드 Expo 토큰을 FCM에 넘기면 InvalidArgument로 실패하고
        # invalid_token 처리에 걸려 토큰이 영구 비활성화된다.
        if token.startswith("ExponentPushToken["):
            return await self._send_expo_push(token, title, body, data, badge, link)

        return await self._send_fcm_push(token, title, body, data, link, platform)

    async def _send_expo_push(
        self,
        token: str,
        title: str,
        body: str,
        data: dict | None = None,
        badge: int | None = None,
        link: str | None = None,
    ) -> PushResult:
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "badge": badge if badge is not None else 1,
            "priority": "high",
        }
        # FCM 경로는 data["link"]로 싣는다 — 앱이 한 곳만 보게 맞춘다
        merged = {**(data or {}), **({"link": link} if link else {})}
        if merged:
            payload["data"] = merged

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )

            if response.status_code != 200:
                logger.error(f"Expo Push API error: {response.status_code} {response.text}")
                return PushResult(success=False, error=f"HTTP {response.status_code}")

            result = response.json()
            ticket = result.get("data", {})

            if ticket.get("status") == "ok":
                ticket_id = ticket.get("id", "")
                logger.info(f"Expo Push sent: token=...{token[-12:]}, ticket={ticket_id}")
                return PushResult(success=True, message_id=ticket_id)

            error_msg = ticket.get("message", "Unknown error")
            error_type = ticket.get("details", {}).get("error", "")

            # DeviceNotRegistered → 토큰 무효화
            if error_type == "DeviceNotRegistered":
                logger.warning(f"Expo Push invalid token ...{token[-12:]}: {error_msg}")
                return PushResult(success=False, error=error_msg, invalid_token=True)

            logger.error(f"Expo Push failed for ...{token[-12:]}: {error_msg}")
            return PushResult(success=False, error=error_msg)

        except Exception as e:
            logger.error(f"Expo Push send failed for ...{token[-12:]}: {e}")
            return PushResult(success=False, error=str(e))

    async def _send_fcm_push(
        self,
        token: str,
        title: str,
        body: str,
        data: dict | None = None,
        link: str | None = None,
        platform: str = "web",
    ) -> PushResult:
        self._ensure_initialized()

        from firebase_admin import messaging
        from firebase_admin.exceptions import (
            InvalidArgumentError,
            NotFoundError,
        )

        # FCM data 값은 모두 문자열이어야 함
        str_data = {}
        if data:
            str_data = {k: str(v) for k, v in data.items() if v is not None}
        if link:
            str_data["link"] = link

        if platform == "android":
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        title=title,
                        body=body,
                        sound="default",
                        channel_id="default",
                    ),
                ),
                data=str_data if str_data else None,
                token=token,
            )
        else:
            # web (기본)
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        icon="/favicon.png",
                    ),
                    fcm_options=messaging.WebpushFCMOptions(
                        link=link,
                    ),
                ),
                data=str_data if str_data else None,
                token=token,
            )

        try:
            result = await asyncio.to_thread(messaging.send, message)
            logger.info(f"FCM Push sent: token=...{token[-8:]}, message_id={result}")
            return PushResult(success=True, message_id=result)

        except (InvalidArgumentError, NotFoundError) as e:
            # 토큰 무효화
            logger.warning(f"Invalid FCM token ...{token[-8:]}: {e}")
            return PushResult(
                success=False,
                error=str(e),
                invalid_token=True,
            )
        except Exception as e:
            logger.error(f"FCM Push send failed for ...{token[-8:]}: {e}")
            return PushResult(success=False, error=str(e))
