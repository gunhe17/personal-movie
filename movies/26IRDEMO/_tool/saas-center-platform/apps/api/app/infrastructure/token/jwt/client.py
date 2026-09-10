from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.infrastructure.token.common.base import Token

TOKEN_VERSION = 2


class Jwt(Token):
    def __init__(
        self,
        *,
        secret_key: str,
        algorithm: str,
        access_expire_minutes: int,
    ) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._access_expire_minutes = access_expire_minutes

    def create_access_token(
        self,
        data: dict[str, Any],
        account_token_version: int = 0,
        expires_delta: timedelta | None = None,
        audience: str | None = None,
    ) -> str:
        # center_id는 JWT에 넣지 않는다 — 센터 접근은 URL path로 구분, 멤버십은 실시간 검증.
        # account_token_version: 권한 변경 시 즉시 로그아웃(토큰 무효화)용.
        to_encode = data.copy()
        to_encode["token_version"] = TOKEN_VERSION
        to_encode["account_token_version"] = account_token_version
        if audience is not None:
            to_encode["aud"] = audience

        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=self._access_expire_minutes
            )
        to_encode.update({"exp": expire})

        return jwt.encode(
            to_encode,
            self._secret_key,
            algorithm=self._algorithm,
        )

    def decode_access_token(self, token: str) -> dict[str, Any] | None:
        # jose는 aud claim이 있으면 audience 인자 없이 JWTError를 낸다 — 검증은 behavior가 수행.
        try:
            return jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm],
                options={"verify_aud": False},
            )
        except JWTError:
            return None

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
    ) -> str:
        # 초대 미리보기용 — 프론트가 payload를 base64 디코딩해 표시. 만료 = 초대 만료(7일).
        payload = {
            "invitation_id": invitation_id,
            "center_id": center_id,
            "center_name": center_name,
            "role_name": role_name,
            "inviter_name": inviter_name,
            "invitee_name": invitee_name,
            "invitee_email": invitee_email,
            "employment_type": employment_type,
            "exp": expires_at,
            "type": "invitation",
        }
        return jwt.encode(
            payload,
            self._secret_key,
            algorithm=self._algorithm,
        )

    def create_admin_invitation_token(
        self,
        invitation_id: str,
        email: str,
        name: str,
        role: str,
        expires_at: datetime,
    ) -> str:
        payload = {
            "invitation_id": invitation_id,
            "email": email,
            "name": name,
            "role": role,
            "exp": expires_at,
            "type": "admin_invitation",
        }
        return jwt.encode(
            payload,
            self._secret_key,
            algorithm=self._algorithm,
        )

    def decode_admin_invitation_token(self, token: str) -> dict[str, Any] | None:
        try:
            payload = jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm],
            )
        except JWTError:
            return None
        if payload.get("type") != "admin_invitation":
            return None
        return payload

