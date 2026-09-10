from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.behavior.common.exception import ForbiddenError, UnauthorizedError
from app.core.behavior import Action
from app.core.type import DevelopError
from app.infrastructure.token.common.base import AUDIENCE_CLIENT_APP
from app.infrastructure.token.factory import get_token

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


@dataclass(frozen=True)
class AccountContext:
    account_id: str
    person_id: str
    email: str

    @classmethod
    async def setup(
        cls,
        *,
        session: AsyncSession,
        authorization: str | None,
        audience: str | None = None,
    ) -> "AccountContext":
        if authorization is None or not authorization.startswith("Bearer "):
            raise UnauthorizedError()
        payload = get_token().decode_access_token(authorization[len("Bearer "):].strip())
        if payload is None or not all(k in payload for k in ("account_id", "person_id", "email")):
            raise UnauthorizedError("Invalid authentication token")
        # audience 교차 차단: 앱 토큰은 직원 표면에, 직원 토큰(aud 없음)은 앱 표면에 못 들어온다.
        if payload.get("aud") != audience:
            raise UnauthorizedError("Token audience mismatch")
        await _assert_token_version(session, payload)
        return cls(
            account_id=payload["account_id"],
            person_id=payload["person_id"],
            email=payload["email"],
        )


class RequireAuthentication(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.account = await AccountContext.setup(session=m.uow.session, authorization=m.authorization)


class RequireAppAuthentication(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.account = await AccountContext.setup(
            session=m.uow.session,
            authorization=m.authorization,
            audience=AUDIENCE_CLIENT_APP,
        )


async def _assert_token_version(session: AsyncSession, payload: dict) -> None:
    from app.modules.auth.account.repository import AccountRepository
    from app.modules.auth.account.services import FindAccountService

    account = await FindAccountService(AccountRepository(session)).execute(payload["account_id"])
    if not account:
        raise UnauthorizedError("Account not found")
    if account.token_version != payload.get("account_token_version", 0):
        raise UnauthorizedError("Token invalidated. Please login again.")


class RequireSelf(Action):
    """path param `person_id`가 토큰 주체 본인인지 — IDOR 게이트."""

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        subject = m.account or m.center
        if subject is None:
            raise DevelopError("require_self()는 authenticate() 계열 뒤에만 선다")
        if "person_id" not in m.request.path_params:
            raise DevelopError("require_self() — person_id path param이 없다")
        if m.request.path_params["person_id"] != subject.person_id:
            raise ForbiddenError("본인 것만 접근할 수 있습니다.")
