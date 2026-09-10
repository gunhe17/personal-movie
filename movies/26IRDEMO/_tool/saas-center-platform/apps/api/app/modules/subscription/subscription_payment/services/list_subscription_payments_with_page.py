from app.infrastructure.persistence.new_repository import Page
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription_payment.repository import (
    SubscriptionPaymentRepository,
)


class ListSubscriptionPaymentsWithPageService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[SubscriptionPayment], Page]:
        # return
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            page=page,
            size=size,
        )
