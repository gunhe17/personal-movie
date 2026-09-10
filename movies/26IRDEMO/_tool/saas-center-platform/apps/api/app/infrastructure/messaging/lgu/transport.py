"""LGUBaseClient — LGU+ Message Hub 공통 transport.

인증 토큰 캐싱/자동 갱신 + httpx 요청을 담당. AlarmTalk/SMS 어댑터가 공유한다.
`get_lgu_client`(factory.py)가 싱글톤으로 취득 — 토큰 캐시를 프로세스 단위로 공유하기 위함.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import httpx

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.messaging.common.exception import (
    AuthenticationException,
    MessageSendException,
)

logger = get_logger(__name__)


class LGUBaseClient:
    def __init__(
        self,
        api_url: str,
        api_key: str,
        api_pwd: str,
        auth_num: str,
    ):
        self.api_url = api_url
        self.api_key = api_key
        self.api_pwd = api_pwd
        self.auth_num = auth_num

        self._access_token: str | None = None
        self._token_expires_at: datetime | None = None

    async def _get_access_token(self) -> str:
        if self._access_token and self._token_expires_at:
            if utc_now() < self._token_expires_at:
                return self._access_token

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self.api_url}/auth/v1/{self.auth_num}",
                    json={
                        "apiKey": self.api_key,
                        "apiPwd": self.api_pwd,
                    },
                )

                if response.status_code != 200:
                    raise AuthenticationException(
                        f"LGU+ authentication failed: {response.status_code} {response.text}"
                    )

                data = response.json()
                self._access_token = data["data"]["token"]
                expires_in = data.get("data", {}).get("expires_in", 3600)

                # 만료 시각 (여유 10분)
                self._token_expires_at = utc_now() + timedelta(seconds=expires_in - 600)

                logger.info("LGU+ access token acquired")
                return self._access_token

            except httpx.HTTPError as e:
                raise AuthenticationException(f"LGU+ auth request failed: {str(e)}") from e

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: dict | None = None,
        retry_count: int = 0,
    ) -> dict:
        token = await self._get_access_token()

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(
                    method,
                    f"{self.api_url}{endpoint}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=json_data,
                )

                # 401: 토큰 만료 → 재인증 후 1회 재시도
                if response.status_code == 401 and retry_count == 0:
                    logger.warning("LGU+ token expired, retrying with new token")
                    self._access_token = None
                    return await self._request(method, endpoint, json_data, retry_count + 1)

                if response.status_code >= 400:
                    error_msg = f"LGU+ API error: {response.status_code} {response.text}"
                    logger.error(error_msg)
                    raise MessageSendException(error_msg)

                return response.json()

            except httpx.HTTPError as e:
                error_msg = f"LGU+ API request failed: {str(e)}"
                logger.error(error_msg, exc_info=True)
                raise MessageSendException(error_msg) from e
