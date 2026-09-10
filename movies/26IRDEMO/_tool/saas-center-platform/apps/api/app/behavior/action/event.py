import json
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import text

from app.core.behavior import Action
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import transactional_uow

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


@dataclass(frozen=True)
class EventGroupContext:
    event_group_id: str

    @classmethod
    async def setup(cls) -> "EventGroupContext":
        return cls(event_group_id=str(uuid4()))


class RequireEventGroup(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.event_group_id = (await EventGroupContext.setup()).event_group_id


class Event(Action):
    @staticmethod
    async def dispatch_event(event_group_id: uuid_str) -> None:
        async with transactional_uow() as uow:
            await uow.session.execute(
                text("SELECT pg_notify('event_group', :p)"),
                {"p": json.dumps({"group_id": event_group_id})},
            )


class RequireDispatch(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        await Event.dispatch_event(m.event_group_id)
