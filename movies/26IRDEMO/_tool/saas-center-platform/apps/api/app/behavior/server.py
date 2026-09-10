from dataclasses import dataclass, field
from typing import AsyncIterator, Callable, Any

from fastapi import BackgroundTasks, Header, Request

from app.behavior.action.account import (
    AccountContext,
    RequireAppAuthentication,
    RequireAuthentication,
    RequireSelf,
)
from app.behavior.action.admin import AdminIdentity, RequireAdminAuth, RequireAdminRole
from app.behavior.action.center import CenterContext, RequireCenter
from app.behavior.action.dispatcher import RequireBatchDispatcher, RequireTaskDispatcher
from app.behavior.action.event import RequireDispatch, RequireEventGroup
from app.behavior.action.feature import RequireFeature
from app.behavior.action.gate import RequireGate
from app.behavior.action.permission import RequirePermission
from app.behavior.action.quota import RequireQuota
from app.behavior.action.rate_limit import RequireRateLimit
from app.core.behavior import Action, Behavior, Context, Memory
from app.core.type import DevelopError, uuid_str
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork, transactional_uow


# #
# Memory


@dataclass
class ServerMemory(Memory):
    # api
    request: Request | None = None
    background_tasks: BackgroundTasks | None = None
    # parameters
    center_id: str | None = None
    authorization: str | None = None
    # auth
    uow: UnitOfWork | None = None
    account: AccountContext | None = None
    center: CenterContext | None = None
    admin: AdminIdentity | None = None
    # event
    event_group_id: str | None = None
    # action artifacts
    required_codes: tuple[str, ...] = ()
    required_feature: str | None = None
    required_roles: tuple[str, ...] = ()
    gate: Callable | None = None
    dispatcher: object | None = None
    rate_limit: tuple | None = None
    required_quota_purpose: str | None = None
    # actions
    _active: set[type] = field(default_factory=set)


# #
# Context

def _declared(
    value: uuid_str | None,
    action: str,
) -> uuid_str:
    # 선언 보장 필드 — 없으면 endpoint가 그 action을 선언하지 않은 것(계약 위반)
    if value is None:
        raise DevelopError(f"{action}을(를) 선언하지 않은 endpoint가 값을 읽었다")
    return value


@dataclass(frozen=True)
class ServerContext(Context):
    """center flow(request/stream)가 yield — 멤버십 해석 완료라 식별·authz 키가 보장된다(owner_scope만 semantic null)."""

    uow: "UnitOfWork"
    center_id: uuid_str
    account_id: uuid_str
    person_id: uuid_str
    actor_id: uuid_str
    role_code: str
    permissions: tuple[str, ...]
    permissions_version: int
    access_level: str
    owner_scope: uuid_str | None = None  # authz row-filter: None=전체, member_id=본인만
    _event_group_id: uuid_str | None = None
    dispatcher: Any = None  # with_dispatcher()/with_batch_dispatcher() 활성 시 AI 잡 디스패처. 타입은 infra 소유라 Any
    ip: str | None = None  # 요청 메타 — 접근 기록(document access log 등). AdminContext.ip와 같은 결
    user_agent: str | None = None

    @property
    def event_group_id(self) -> uuid_str:
        return _declared(self._event_group_id, "start_event_group()")


@dataclass(frozen=True)
class UnscopedContext(Context):
    """request_unscoped(account/machine)가 yield — center 없음. account면 person/account_id, machine이면 둘 다 None. admin은 AdminContext(별도)."""

    uow: "UnitOfWork"
    _person_id: uuid_str | None = None
    _account_id: uuid_str | None = None
    _event_group_id: uuid_str | None = None
    dispatcher: Any = None  # with_dispatcher()/with_batch_dispatcher() 활성 시 AI 잡 디스패처

    @property
    def person_id(self) -> uuid_str:
        return _declared(self._person_id, "authenticate()")

    @property
    def account_id(self) -> uuid_str:
        return _declared(self._account_id, "authenticate()")

    @property
    def event_group_id(self) -> uuid_str:
        return _declared(self._event_group_id, "start_event_group()")


@dataclass(frozen=True)
class AdminContext(Context):
    """request_admin이 yield — 플랫폼 운영자 flow. RequireAdminAuth 뒤라 admin_account_id·email·role 보장(center 없음)."""

    uow: "UnitOfWork"
    admin_account_id: uuid_str  # actor — audit emit actor_id
    email: str  # actor 이메일 — created_by 스냅샷·감사 표시
    role: str  # actor 역할 — owner-scope authz(본인 리소스만)
    ip: str | None = None  # 요청 IP — 감사 event.ip_address
    _event_group_id: uuid_str | None = None
    dispatcher: Any = None

    @property
    def event_group_id(self) -> uuid_str:
        return _declared(self._event_group_id, "start_event_group()")


# #
# Server

class Server(Behavior):
    def request(self, *requires: Action) -> Callable[..., AsyncIterator[ServerContext]]:
        """센터 요청 (center_id path param). tx는 transactional_uow(clean exit 자동커밋)."""

        async def dep(
            request: Request,
            center_id: str,
            background_tasks: BackgroundTasks,
            authorization: str | None = Header(default=None),
        ) -> AsyncIterator[ServerContext]:
            memory = ServerMemory()
            memory.request = request
            memory.background_tasks = background_tasks
            memory.center_id = center_id
            memory.authorization = authorization

            for action in [*requires]:
                action.apply(memory)

            if memory.is_active(RequireEventGroup):
                await RequireEventGroup.act(memory)

            async with transactional_uow() as uow:
                memory.uow = uow

                if memory.is_active(RequireAuthentication):
                    await RequireAuthentication.act(memory)

                if memory.is_active(RequireCenter):
                    await RequireCenter.act(memory)

                if memory.is_active(RequireSelf):
                    await RequireSelf.act(memory)

                if memory.is_active(RequirePermission):
                    await RequirePermission.act(memory)

                if memory.is_active(RequireFeature):
                    await RequireFeature.act(memory)

                if memory.is_active(RequireRateLimit):
                    await RequireRateLimit.act(memory)

                if memory.is_active(RequireQuota):
                    await RequireQuota.act(memory)

                if memory.is_active(RequireTaskDispatcher):
                    await RequireTaskDispatcher.act(memory)

                if memory.is_active(RequireBatchDispatcher):
                    await RequireBatchDispatcher.act(memory)

                assert memory.center is not None
                yield ServerContext(
                    uow=uow,
                    person_id=memory.center.person_id,
                    account_id=memory.center.account_id,
                    center_id=memory.center.center_id,
                    actor_id=memory.center.member_id,
                    role_code=memory.center.role_code,
                    permissions=tuple(memory.center.permissions),
                    owner_scope=memory.center.owner_scope,
                    permissions_version=memory.center.permissions_version,
                    access_level=memory.center.access_level,
                    _event_group_id=memory.event_group_id,
                    dispatcher=memory.dispatcher,
                    ip=memory.request.client.host if memory.request and memory.request.client else None,
                    user_agent=memory.request.headers.get("user-agent") if memory.request else None,
                )

            if memory.is_active(RequireDispatch):
                await RequireDispatch.act(memory)

        return dep

    def stream(self, *requires: Action) -> Callable[..., AsyncIterator[ServerContext]]:
        """센터 SSE/WebSocket — 인증은 behavior, tx는 스트림 핸들러가 소유.

        request와 유일한 차이: transactional_uow(clean exit 자동커밋/예외 rollback) 대신
        AsyncSessionLocal(수동 커밋). 스트림 핸들러가 진행을 점진 커밋하면
        disconnect(예외) 시에도 이미 커밋된 진행은 보존된다(미커밋만 세션 close에서 정리).
        단일 커밋 지점이 없어 dispatch 없음.
        """

        async def dep(
            request: Request,
            center_id: str,
            authorization: str | None = Header(default=None),
        ) -> AsyncIterator[ServerContext]:
            memory = ServerMemory()
            memory.request = request
            memory.center_id = center_id
            memory.authorization = authorization

            for action in [*requires]:
                action.apply(memory)

            async with AsyncSessionLocal() as session:
                memory.uow = UnitOfWork(session)

                if memory.is_active(RequireAuthentication):
                    await RequireAuthentication.act(memory)

                if memory.is_active(RequireCenter):
                    await RequireCenter.act(memory)

                if memory.is_active(RequirePermission):
                    await RequirePermission.act(memory)

                if memory.is_active(RequireFeature):
                    await RequireFeature.act(memory)

                if memory.is_active(RequireRateLimit):
                    await RequireRateLimit.act(memory)

                if memory.is_active(RequireQuota):
                    await RequireQuota.act(memory)

                assert memory.center is not None
                yield ServerContext(
                    uow=memory.uow,
                    person_id=memory.center.person_id,
                    account_id=memory.center.account_id,
                    center_id=memory.center.center_id,
                    actor_id=memory.center.member_id,
                    role_code=memory.center.role_code,
                    permissions=tuple(memory.center.permissions),
                    owner_scope=memory.center.owner_scope,
                    permissions_version=memory.center.permissions_version,
                    access_level=memory.center.access_level,
                    ip=memory.request.client.host if memory.request and memory.request.client else None,
                    user_agent=memory.request.headers.get("user-agent") if memory.request else None,
                )

        return dep

    def request_unscoped(
        self, *requires: Action
    ) -> Callable[..., AsyncIterator[UnscopedContext]]:
        """비센터 요청 (account/admin/public) — 주체는 action이 결정. center_id path 없음.

        stateless 게이트(gate/admin 토큰)는 tx 전, 세션 필요한 account 인증은 tx 안.
        yield Context는 있는 것만 채움(account면 person_id/account_id, 아니면 None).
        """

        async def dep(
            request: Request,
            background_tasks: BackgroundTasks,
            authorization: str | None = Header(default=None),
        ) -> AsyncIterator[UnscopedContext]:
            memory = ServerMemory()
            memory.request = request
            memory.background_tasks = background_tasks
            memory.authorization = authorization

            for action in [*requires]:
                action.apply(memory)

            if memory.is_active(RequireEventGroup):
                await RequireEventGroup.act(memory)
            if memory.is_active(RequireGate):
                await RequireGate.act(memory)
            if memory.is_active(RequireAdminAuth):
                await RequireAdminAuth.act(memory)
            if memory.is_active(RequireAdminRole):
                await RequireAdminRole.act(memory)

            async with transactional_uow() as uow:
                memory.uow = uow

                if memory.is_active(RequireAuthentication):
                    await RequireAuthentication.act(memory)
                if memory.is_active(RequireAppAuthentication):
                    await RequireAppAuthentication.act(memory)

                if memory.is_active(RequireSelf):
                    await RequireSelf.act(memory)

                if memory.is_active(RequireTaskDispatcher):
                    await RequireTaskDispatcher.act(memory)
                if memory.is_active(RequireBatchDispatcher):
                    await RequireBatchDispatcher.act(memory)

                yield UnscopedContext(
                    uow=uow,
                    _person_id=memory.account.person_id if memory.account else None,
                    _account_id=memory.account.account_id if memory.account else None,
                    _event_group_id=memory.event_group_id,
                    dispatcher=memory.dispatcher,
                )

            if memory.is_active(RequireDispatch):
                await RequireDispatch.act(memory)

        return dep

    def request_admin(
        self, *requires: Action
    ) -> Callable[..., AsyncIterator[AdminContext]]:
        """플랫폼 운영자 요청 — admin 토큰 신원. center_id path 없음, center 멤버십 없음.

        admin 토큰은 stateless라 tx 전 검증(RequireAdminAuth/Role), 세션 필요한 작업은 tx 안.
        감사는 handler의 emit(actor_type='admin')으로.
        """

        async def dep(
            request: Request,
            background_tasks: BackgroundTasks,
            authorization: str | None = Header(default=None),
        ) -> AsyncIterator[AdminContext]:
            memory = ServerMemory()
            memory.request = request
            memory.background_tasks = background_tasks
            memory.authorization = authorization

            for action in [*requires]:
                action.apply(memory)

            if memory.is_active(RequireEventGroup):
                await RequireEventGroup.act(memory)
            if memory.is_active(RequireAdminAuth):
                await RequireAdminAuth.act(memory)
            if memory.is_active(RequireAdminRole):
                await RequireAdminRole.act(memory)

            async with transactional_uow() as uow:
                memory.uow = uow

                if memory.is_active(RequireTaskDispatcher):
                    await RequireTaskDispatcher.act(memory)
                if memory.is_active(RequireBatchDispatcher):
                    await RequireBatchDispatcher.act(memory)

                assert memory.admin is not None  # authenticate_admin() 선언 필수
                yield AdminContext(
                    uow=uow,
                    admin_account_id=memory.admin.admin_account_id,
                    email=memory.admin.email,
                    role=memory.admin.role,
                    ip=memory.request.client.host if memory.request and memory.request.client else None,
                    _event_group_id=memory.event_group_id,
                    dispatcher=memory.dispatcher,
                )

            if memory.is_active(RequireDispatch):
                await RequireDispatch.act(memory)

        return dep

    def stream_unscoped(
        self, *requires: Action
    ) -> Callable[..., AsyncIterator[UnscopedContext]]:
        raise NotImplementedError(
            "비센터 SSE/WS 소비자 없음 — 필요 시 stream 패턴(AsyncSessionLocal)으로 구현"
        )


behavior = Server()
