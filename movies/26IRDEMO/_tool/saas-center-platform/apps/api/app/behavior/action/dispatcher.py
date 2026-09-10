from typing import TYPE_CHECKING

from app.core.behavior import Action

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequireTaskDispatcher(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        from app.infrastructure.worker.factory import get_task_dispatcher

        m.dispatcher = await get_task_dispatcher(m.background_tasks)


class RequireBatchDispatcher(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        from app.infrastructure.worker.factory import get_batch_dispatcher

        m.dispatcher = await get_batch_dispatcher(m.background_tasks)
