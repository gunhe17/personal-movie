import json

from app.application.events.dispatch import dispatch_event_handler
from app.application.events.routes import EVENT_REACTIONS
from app.behavior import use_event_action


async def on_event_group(raw: str) -> None:
    group_id = json.loads(raw)["group_id"]

    async with use_event_action(group_id) as scope:
        if scope is None:
            return
        await dispatch_event_handler(
            uow=scope.uow,
            center_id=scope.center_id,
            event_group_id=scope.event_group_id,
            table=EVENT_REACTIONS,
            actor_id=scope.actor_id,
        )
