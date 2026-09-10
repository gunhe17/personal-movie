from typing import TYPE_CHECKING

from app.behavior.common.exception import ForbiddenError
from app.core.behavior import Action

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequirePermission(Action):
    def __init__(self, *codes: str) -> None:
        self.codes = codes

    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self))
        m.required_codes = self.codes

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        if "*" in m.center.permissions:
            return
        if not all(c in m.center.permissions for c in m.required_codes):
            raise ForbiddenError(f"Permission denied: {', '.join(m.required_codes)}")
