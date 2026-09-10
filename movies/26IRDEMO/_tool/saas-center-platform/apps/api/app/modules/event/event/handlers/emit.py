from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import EventRepository

# 조립층이 도메인 핸들러 실행을 감쌀 때 시그니처 관통 없이 표식 주입 — AI gate가
# emit_actor_type("agent")로 감싸면 그 안의 모든 emit에 "AI 경유" 표식. actor_id는 member 유지
# (책임은 사람, 감사는 actor_type='agent' 필터).
_actor_type_override: ContextVar[str | None] = ContextVar(
    "emit_actor_type_override", default=None
)


@contextmanager
def emit_actor_type(value: str) -> Iterator[None]:
    token = _actor_type_override.set(value)
    try:
        yield
    finally:
        _actor_type_override.reset(token)


async def emit(
    uow: UnitOfWork,
    name: str,
    *,
    event_group_id: uuid_str,
    atomics: list,
    center_id: uuid_str | None = None,
    actor_id: uuid_str | None = None,
    actor_type: str = "member",
    ip_address: str | None = None,
) -> None:
    # 빈 atomics = 기록할 사실 없음 → 유령 이벤트 방지(호출처가 `if atomics`/`if atomic`으로
    # 가드 안 하게 여기서). None 원소(조건부 생성 atomic이 no-op이면 None)도 걸러 empty로 수렴.
    atomics = [a for a in atomics if a is not None]
    if not atomics:
        return

    await uow.repo(EventRepository).insert(
        event_group_id=event_group_id,
        name=name,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
        actor_type=_actor_type_override.get() or actor_type,
        ip_address=ip_address,
    )
