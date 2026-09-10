from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from app.behavior.action.act import Act
from app.behavior.action.event import Event, EventGroupContext
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork, transactional_uow

logger = get_logger(__name__)


@dataclass(frozen=True)
class Scope:
    uow: UnitOfWork
    center_id: str | None = None
    actor_id: str | None = None
    event_group_id: str | None = None


@asynccontextmanager
async def use_cron_action(
    *,
    lock_key: int,
    name: str,
) -> AsyncIterator[Scope | None]:
    """cron 잡 진입 — tx는 transactional_uow 소유, advisory xact lock으로 멀티 레플리카 중 1개만.

    lock 미획득(다른 레플리카 실행 중) = None yield → 호출자 skip.
    핸들러는 tx-free여야 한다(내부 커밋 시 xact lock 조기 해제).
    """
    event_group_id = (await EventGroupContext.setup()).event_group_id
    async with transactional_uow() as uow:
        if not await uow.try_advisory_xact_lock(lock_key):
            logger.debug("%s: advisory lock held by another replica, skipping", name)
            yield None
            return
        yield Scope(uow=uow, event_group_id=event_group_id)
    await Event.dispatch_event(event_group_id)


@asynccontextmanager
async def use_event_action(event_group_id: str) -> AsyncIterator[Scope | None]:
    # claim
    async with transactional_uow() as uow:
        claimed = await Act.claim(uow, id=event_group_id)
        center_id = claimed.center_id if claimed is not None else None
        actor_id = claimed.actor_id if claimed is not None else None
    if claimed is None:
        yield None
        return

    # run
    try:
        async with transactional_uow() as uow:
            yield Scope(
                uow=uow,
                center_id=center_id,
                actor_id=actor_id,
                event_group_id=event_group_id,
            )
    except Exception:
        async with transactional_uow() as uow:
            await Act.fail(uow, id=event_group_id)
        raise

    # succeed
    async with transactional_uow() as uow:
        await Act.succeed(uow, id=event_group_id)
