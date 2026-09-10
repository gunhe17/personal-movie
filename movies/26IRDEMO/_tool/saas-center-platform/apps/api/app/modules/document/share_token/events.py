from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ShareToken
from .schemas import ShareTokenResponse


@dataclass(frozen=True, kw_only=True)
class ShareTokenAtomic:
    _act: str
    share_token: ShareToken

    @classmethod
    def created(
        cls, *, share_token: ShareToken
    ) -> tuple["ShareTokenAtomic", ShareToken]:
        return cls(_act="created", share_token=share_token), share_token

    @classmethod
    def downloaded(
        cls, *, share_token: ShareToken
    ) -> tuple["ShareTokenAtomic", ShareToken]:
        return cls(_act="downloaded", share_token=share_token), share_token

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "share_token"

    def act_entity_id(self) -> uuid_str:
        return self.share_token.id

    def payload(self) -> dict:
        # token 은 공유 비밀이라 audit payload 에서 제외 (eventing.md 민감값 금지)
        dump = ShareTokenResponse.model_validate(self.share_token).model_dump(
            mode="json", exclude={"token"}
        )
        return {"data": dump}
