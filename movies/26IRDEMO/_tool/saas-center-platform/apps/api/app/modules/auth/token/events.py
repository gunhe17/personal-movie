from dataclasses import dataclass

from app.core.type import uuid_str

from .models import RefreshToken


@dataclass(frozen=True, kw_only=True)
class RefreshTokenAtomic:
    _act: str
    token: RefreshToken

    @classmethod
    def created(
        cls, *, token: RefreshToken
    ) -> tuple["RefreshTokenAtomic", RefreshToken]:
        return cls(_act="created", token=token), token

    @classmethod
    def revoked(
        cls, *, token: RefreshToken
    ) -> tuple["RefreshTokenAtomic", RefreshToken]:
        return cls(_act="revoked", token=token), token

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "refresh_token"

    def act_entity_id(self) -> uuid_str:
        return self.token.id

    def payload(self) -> dict:
        # 세션 사실만 — 토큰 값 금지(발급은 id·만료만)
        if self._act == "created":
            return {
                "data": {
                    "account_id": self.token.account_id,
                    "expires_at": self.token.expires_at.isoformat(),
                }
            }
        return {
            "data": {
                "account_id": self.token.account_id,
                "device_info": self.token.device_info,
            }
        }
