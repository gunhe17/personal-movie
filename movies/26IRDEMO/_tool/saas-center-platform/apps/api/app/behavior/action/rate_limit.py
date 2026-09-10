from typing import TYPE_CHECKING

from app.core.behavior import Action
from app.infrastructure.rate_limit.factory import get_rate_limiter

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequireRateLimit(Action):
    """요청 빈도 게이트(post-auth). 키 = {scope}:{member_id}, 1분 윈도우.

    정책(scope/per_minute/enabled)은 endpoint가 주입 — behavior는 도메인 무지. RequireCenter 뒤에
    실행(member_id 필요). 삭제된 dependencies/block/abuse의 자리.
    """

    def __init__(self, *, scope: str, per_minute: int, enabled: bool = True) -> None:
        self.scope = scope
        self.per_minute = per_minute
        self.enabled = enabled

    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self))
        m.rate_limit = (self.scope, self.per_minute, self.enabled)

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        scope, per_minute, enabled = m.rate_limit
        if not enabled:
            return
        get_rate_limiter().check_and_record(
            f"{scope}:{m.center.member_id}",
            limit=per_minute,
            window_minutes=1,
        )
