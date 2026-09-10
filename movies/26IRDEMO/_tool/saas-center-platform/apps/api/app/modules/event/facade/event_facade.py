from dataclasses import dataclass

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..event.repository import EventRepository
from ..event.services import FindEventService, ListEventAtomicsService
from ..event_reaction.repository import EventReactionRepository
from ..event_reaction.services import ListCompletedReactionsService, MarkReactionService


@dataclass(frozen=True)
class DispatchView:
    name: str  # event 이름 (라우팅 키)
    combined: dict  # {"{entity}.{act}": [payload, ...]}
    done: set[str]  # 이미 성공한 반응 이름 (재개용)


def _combine(atomics) -> dict:
    combined: dict = {}
    for a in atomics:
        combined.setdefault(f"{a.entity_name}.{a.act}", []).append(a.payload)
    return combined


class EventFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def load_dispatch(self, *, event_group_id: uuid_str) -> DispatchView | None:
        event_repo = self._uow.repo(EventRepository)
        event = await FindEventService(event_repo).execute(event_group_id)
        if event is None:
            return None
        atomics = await ListEventAtomicsService(event_repo).execute(event_group_id)
        done = await ListCompletedReactionsService(
            self._uow.repo(EventReactionRepository)
        ).execute(event_group_id)
        return DispatchView(name=event.name, combined=_combine(atomics), done=done)

    async def mark_reaction(
        self,
        *,
        event_group_id: uuid_str,
        reaction: str,
        ok: bool,
        error: str | None = None,
    ) -> None:
        await MarkReactionService(self._uow.repo(EventReactionRepository)).execute(
            event_group_id, reaction=reaction, ok=ok, error=error
        )
