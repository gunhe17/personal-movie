from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.behavior.common.exception import ForbiddenError, UnauthorizedError
from app.core.behavior import Action
from app.infrastructure.token.factory import get_token

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


@dataclass(frozen=True)
class AdminIdentity:
    admin_account_id: str
    email: str
    role: str

    @classmethod
    async def setup(cls, *, authorization: str | None) -> "AdminIdentity":
        if authorization is None or not authorization.startswith("Bearer "):
            raise UnauthorizedError()
        payload = get_token().decode_access_token(authorization[len("Bearer "):].strip())
        if not payload:
            raise UnauthorizedError("유효하지 않거나 만료된 토큰입니다")
        if payload.get("token_type") != "admin":  # 센터 토큰 혼용 방지
            raise UnauthorizedError("어드민 토큰이 아닙니다")
        admin_account_id = payload.get("admin_account_id")
        if not admin_account_id:
            raise UnauthorizedError("토큰 정보가 올바르지 않습니다")
        return cls(
            admin_account_id=admin_account_id,
            email=payload.get("email", ""),
            role=payload.get("role", ""),
        )


class RequireAdminAuth(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.admin = await AdminIdentity.setup(authorization=m.authorization)


class RequireAdminRole(Action):
    def __init__(self, *roles: str) -> None:
        self.roles = roles

    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self))
        m.required_roles = self.roles

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        if m.admin.role not in m.required_roles:
            raise ForbiddenError(f"이 작업에는 {', '.join(m.required_roles)} 권한이 필요합니다")
