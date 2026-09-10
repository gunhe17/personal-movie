from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, NamedTuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.behavior.action.account import AccountContext
from app.behavior.common.exception import ForbiddenError
from app.core.behavior import Action
from app.core.config import settings

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class Mode(str, Enum):
    ANY = "any"
    ALL = "all"


@dataclass(frozen=True)
class CenterContext:
    center_id: str
    account_id: str
    person_id: str
    email: str
    member_id: str
    role_code: str
    permissions: list[str]
    permissions_version: int
    access_level: str
    owner_scope: str | None

    @classmethod
    async def setup(
        cls,
        center_id: str,
        *,
        session: AsyncSession,
        account: AccountContext,
        codes: tuple[str, ...] = (),
        mode: Mode = Mode.ALL,
        plan: tuple[str, ...] | None = None,
        feature: str | None = None,
    ) -> "CenterContext":
        acc = await resolve_access(session, center_id, account.person_id)
        _check_permissions(acc, codes, mode)
        await _check_plan(session, center_id, plan, feature)

        return cls(
            center_id=center_id,
            account_id=account.account_id,
            person_id=account.person_id,
            email=account.email,
            member_id=acc.member_id,
            role_code=acc.role_code,
            permissions=acc.permissions,
            permissions_version=acc.permissions_version,
            access_level=acc.access_level,
            owner_scope=acc.owner_scope,
        )


class RequireCenter(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.center = await CenterContext.setup(m.center_id, session=m.uow.session, account=m.account)
        # server/middleware가 opt-in 시 X-Permission-Version 헤더로 echo
        m.request.state.permissions_version = m.center.permissions_version


# #
# helper

class _Access(NamedTuple):
    member_id: str
    role_code: str
    permissions: list[str]
    permissions_version: int
    access_level: str
    owner_scope: str | None


async def resolve_access(session: AsyncSession, center_id: str, person_id: str) -> _Access:
    from app.modules.center.member.repository import MemberRepository
    from app.modules.center.member.services import FindMemberByPersonService
    from app.modules.role import GetPermissionCodesByRoleService, FindRoleWithVersionService
    from app.modules.role.role.repository import RoleRepository
    from app.modules.role.role_permission.repository import RolePermissionRepository

    member = await FindMemberByPersonService(MemberRepository(session)).execute(center_id, person_id)
    if not member:
        raise ForbiddenError(f"You do not have access to center {center_id}")
    role = await FindRoleWithVersionService(RoleRepository(session)).execute(member.role_id)
    if not role:
        raise ForbiddenError("Role not found")
    permissions = await GetPermissionCodesByRoleService(RolePermissionRepository(session)).execute(role.id)
    owner_scope = None if ("*" in permissions or role.access_level == "all") else member.id
    return _Access(member.id, role.code, permissions, role.version, role.access_level, owner_scope)


def _check_permissions(acc: _Access, codes: tuple[str, ...], mode: Mode) -> None:
    if not codes or "*" in acc.permissions:
        return
    ok = (any if mode is Mode.ANY else all)(c in acc.permissions for c in codes)
    if not ok:
        raise ForbiddenError(f"Permission denied ({mode.value}): {', '.join(codes)}")


async def _check_plan(
    session: AsyncSession,
    center_id: str,
    plan: tuple[str, ...] | None,
    feature: str | None,
) -> None:
    if not (plan or feature) or settings.DEBUG:
        return
    plan_type = await _get_plan(session, center_id)
    if plan and plan_type not in plan:
        raise ForbiddenError(f"Plan required: {', '.join(plan)}")
    if feature:
        from app.modules.subscription.subscription.plan_config import is_feature_allowed
        if not is_feature_allowed(plan_type, feature):
            raise ForbiddenError(f"Feature denied: {feature}")


async def _get_plan(session: AsyncSession, center_id: str) -> str:
    from app.modules.subscription.subscription.repository import SubscriptionRepository
    from app.modules.subscription.subscription.services import GetSubscriptionService

    sub = await GetSubscriptionService(SubscriptionRepository(session)).execute_or_none(center_id)
    return sub.plan if sub else "free"
