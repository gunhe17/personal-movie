"""behavior 선언부 DSL — bare action 팩토리.

endpoint가 `behavior.request(authenticate(), require_membership(), ...)`처럼 쓴다.
각 함수는 대응 Action을 생성할 뿐 — flow는 Action 클래스로 매칭(이름 무관).

- 인증: authenticate / authenticate_admin
- 게이트(거부): require_membership / require_self / require_role / require_permission / require_feature / throttle / gate
- 설정·이펙트(거부 안 함): start_event_group / dispatch_events
"""

from typing import Awaitable, Callable

from fastapi import Request

from app.behavior.action.account import (
    RequireAppAuthentication,
    RequireAuthentication,
    RequireSelf,
)
from app.behavior.action.admin import RequireAdminAuth, RequireAdminRole
from app.behavior.action.center import RequireCenter
from app.behavior.action.dispatcher import RequireBatchDispatcher, RequireTaskDispatcher
from app.behavior.action.event import RequireDispatch, RequireEventGroup
from app.behavior.action.feature import RequireFeature
from app.behavior.action.gate import RequireGate
from app.behavior.action.permission import RequirePermission
from app.behavior.action.quota import RequireQuota
from app.behavior.action.rate_limit import RequireRateLimit
from app.core.behavior import Action


# 인증
def authenticate() -> Action:
    return RequireAuthentication()


def authenticate_admin() -> Action:
    return RequireAdminAuth()


def authenticate_app() -> Action:
    return RequireAppAuthentication()


# 게이트 (통과 아니면 거부)
def require_membership() -> Action:
    return RequireCenter()


def require_self() -> Action:
    return RequireSelf()


def require_role(*roles: str) -> Action:
    return RequireAdminRole(*roles)


def require_permission(*codes: str) -> Action:
    return RequirePermission(*codes)


def require_feature(feature: str) -> Action:
    return RequireFeature(feature)


def throttle(*, scope: str, per_minute: int, enabled: bool = True) -> Action:
    return RequireRateLimit(scope=scope, per_minute=per_minute, enabled=enabled)


def require_quota(purpose: str) -> Action:
    return RequireQuota(purpose)


def gate(verify: Callable[[Request], Awaitable[None]]) -> Action:
    return RequireGate(verify)


# 설정·이펙트 (거부 안 함)
def start_event_group() -> Action:
    return RequireEventGroup()


def dispatch_events() -> Action:
    return RequireDispatch()


def with_dispatcher() -> Action:
    return RequireTaskDispatcher()


def with_batch_dispatcher() -> Action:
    return RequireBatchDispatcher()
