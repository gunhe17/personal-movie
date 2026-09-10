from dataclasses import dataclass
from typing import Awaitable, Callable

from app.core.type import uuid_str
from app.behavior.action.event import Event, EventGroupContext
from app.infrastructure.persistence.unit_of_work import UnitOfWork, transactional_uow
from app.modules.event import EventFacade, acting_event_actor


@dataclass(frozen=True)
class Route:
    handler: Callable[..., Awaitable[None]]
    source: str  # combine 키 "{entity}.{act}"
    project: Callable[[dict], dict] = lambda payload: payload
    name: str = ""  # 체크포인트 키. 빈값이면 handler.__name__


async def dispatch_event_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: uuid_str,
    table: dict[str, list[Route]],
    actor_id: str | None = None,
) -> None:
    # 배치 실행 handler (orchestrator flavor) — 반응별 tx 격리·체크포인트를 이 handler가 소유.
    # leaf handler는 여기서 준 uow로 tx-free. (application handler지만 tx-free 규칙의 예외:
    # 반응별 독립 커밋이 필요해 자기 tx를 연다. ASYNC-ARCHITECTURE.md two-flavor)
    view = await EventFacade(uow).load_dispatch(event_group_id=event_group_id)
    if view is None:
        return
    routes = table.get(view.name, [])
    if not routes:
        return

    failed: list[str] = []
    for route in routes:
        name = route.name or route.handler.__name__
        if name in view.done:
            continue
        try:
            child_event_group_ids: list[str] = []
            async with transactional_uow() as tx_uow:
                for payload in view.combined.get(route.source, []):
                    child_event_group_id = (
                        await EventGroupContext.setup()
                    ).event_group_id
                    # 반응 handler 전체에 actor_id를 관통시키지 않고 필요한 쪽만 읽는다
                    with acting_event_actor(actor_id):
                        await route.handler(
                            uow=tx_uow,
                            center_id=center_id,
                            event_group_id=child_event_group_id,
                            **route.project(payload),
                        )
                    if (
                        await EventFacade(tx_uow).load_dispatch(
                            event_group_id=child_event_group_id
                        )
                        is not None
                    ):
                        child_event_group_ids.append(child_event_group_id)
                await EventFacade(tx_uow).mark_reaction(
                    event_group_id=event_group_id, reaction=name, ok=True
                )
            for child_event_group_id in child_event_group_ids:
                await Event.dispatch_event(child_event_group_id)
        except Exception as error:
            failed.append(name)
            async with transactional_uow() as tx_uow:
                await EventFacade(tx_uow).mark_reaction(
                    event_group_id=event_group_id,
                    reaction=name,
                    ok=False,
                    error=str(error)[:500],
                )

    if failed:
        raise RuntimeError(f"reactions failed: {failed}")
