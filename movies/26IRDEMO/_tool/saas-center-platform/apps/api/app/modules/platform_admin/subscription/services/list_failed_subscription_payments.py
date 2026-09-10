from app.infrastructure.persistence.new_repository import Page
from app.modules.platform_admin.subscription.repository import (
    AdminSubscriptionRepository,
)


class ListFailedSubscriptionPaymentsService:
    def __init__(
        self,
        repo: AdminSubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[dict], Page]:
        # return
        return await self.repo.list_failed_with_center_with_page(
            page=page,
            size=size,
        )
