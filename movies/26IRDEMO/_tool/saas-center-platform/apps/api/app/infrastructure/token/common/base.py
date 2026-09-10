from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any


# aud claim 값 — 내담자 앱 토큰. 없으면 SaaS 직원 표면용(기발급 토큰 하위호환).
AUDIENCE_CLIENT_APP = "client_app"


class Token(ABC):
    @abstractmethod
    def create_access_token(
        self,
        data: dict[str, Any],
        account_token_version: int = 0,
        expires_delta: timedelta | None = None,
        audience: str | None = None,
    ) -> str: ...

    @abstractmethod
    def decode_access_token(self, token: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def create_invitation_token(
        self,
        invitation_id: str,
        center_id: str,
        center_name: str,
        role_name: str,
        inviter_name: str,
        invitee_name: str,
        invitee_email: str,
        employment_type: str | None,
        expires_at: datetime,
    ) -> str: ...

    @abstractmethod
    def create_admin_invitation_token(
        self,
        invitation_id: str,
        email: str,
        name: str,
        role: str,
        expires_at: datetime,
    ) -> str: ...

    @abstractmethod
    def decode_admin_invitation_token(self, token: str) -> dict[str, Any] | None: ...
