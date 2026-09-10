from typing import TYPE_CHECKING

from app.behavior.common.exception import ForbiddenError
from app.core.behavior import Action
from app.core.config import settings

if TYPE_CHECKING:
    from app.behavior.server import ServerMemory


class RequireFeature(Action):
    def __init__(self, feature: str) -> None:
        self.feature = feature

    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self))
        m.required_feature = self.feature

    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        if settings.DEBUG:
            return
        from app.modules.subscription.subscription.plan_config import is_feature_allowed
        from app.modules.subscription.subscription.repository import SubscriptionRepository
        from app.modules.subscription.subscription.services import GetSubscriptionService

        sub = await GetSubscriptionService(SubscriptionRepository(m.uow.session)).execute_or_none(m.center_id)
        if not is_feature_allowed(sub.plan if sub else "free", m.required_feature):
            raise ForbiddenError(f"Feature denied: {m.required_feature}")
