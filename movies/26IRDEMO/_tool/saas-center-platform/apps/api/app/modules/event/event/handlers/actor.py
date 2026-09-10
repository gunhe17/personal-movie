"""반응 실행 중인 이벤트의 행위자(member_id) — 시그니처 관통 없이 노출.

`emit_actor_type`과 같은 결의 contextvar다. 반응 handler 40여 개와 `EVENT_REACTIONS`
표 전체에 `actor_id` 인자를 관통시키지 않고, 필요한 반응만 읽어 간다.

첫 소비자 = 알림 수신자 계산(`notification.helpers`) — "본인이 한 액션의 알림은
본인에게 가지 않는다"는 handler별 선택이 아니라 **전역 정책**이라, 개별 handler가
인자를 잊으면 조용히 깨지는 관통 방식 대신 기본값으로 두고 예외만 opt-out한다.

setter의 유일한 주체는 dispatch다. cron·스크립트 경로에는 행위자가 없어 None이고,
그때는 제외가 일어나지 않는다.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

_event_actor_id: ContextVar[str | None] = ContextVar("event_actor_id", default=None)


@contextmanager
def acting_event_actor(member_id: str | None) -> Iterator[None]:
    token = _event_actor_id.set(member_id)
    try:
        yield
    finally:
        _event_actor_id.reset(token)


def current_event_actor_id() -> str | None:
    """지금 실행 중인 반응을 유발한 사람의 member_id (없으면 None — cron·시스템 경로)."""
    return _event_actor_id.get()
