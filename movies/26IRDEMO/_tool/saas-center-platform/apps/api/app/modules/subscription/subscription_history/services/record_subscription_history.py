from app.core.type import utc_dt
from app.modules.subscription.subscription_history.models import SubscriptionHistory
from app.modules.subscription.subscription_history.repository import (
    SubscriptionHistoryRepository,
)


class RecordSubscriptionHistoryService:
    def __init__(
        self,
        repo: SubscriptionHistoryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        subscription_id: str,
        *,
        to_plan: str,
        actor_type: str,
        reason: str,
        changed_at: utc_dt,
        from_plan: str | None = None,
        from_status: str | None = None,
        to_status: str | None = None,
    ) -> SubscriptionHistory:
        # return
        return await self.repo.add_for_subscription(
            subscription_id=subscription_id,
            from_plan=from_plan,
            to_plan=to_plan,
            from_status=from_status,
            to_status=to_status,
            actor_type=actor_type,
            reason=reason,
            changed_at=changed_at,
        )
