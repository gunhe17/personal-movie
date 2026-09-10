from app.core.behavior import Action
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event.event.repository import EventRepository


class Act(Action):
    @staticmethod
    async def claim(uow: UnitOfWork, *, id: uuid_str):
        return await uow.repo(EventRepository).claim(id=id)

    @staticmethod
    async def succeed(uow: UnitOfWork, *, id: uuid_str) -> None:
        await uow.repo(EventRepository).succeed(id=id)

    @staticmethod
    async def fail(uow: UnitOfWork, *, id: uuid_str) -> None:
        await uow.repo(EventRepository).fail(id=id)
