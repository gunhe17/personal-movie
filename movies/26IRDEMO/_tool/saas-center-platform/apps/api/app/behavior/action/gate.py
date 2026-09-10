from typing import TYPE_CHECKING, Awaitable, Callable

from fastapi import Request

from app.core.behavior import Action

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequireGate(Action):
    def __init__(self, verify: Callable[[Request], Awaitable[None]]) -> None:
        self.verify = verify

    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self))
        m.gate = self.verify

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        await m.gate(m.request)
