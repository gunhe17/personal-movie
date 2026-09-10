from app.modules.platform_admin.subscription.repository import (
    AdminSubscriptionRepository,
)


class ListSubscriptionsService:
    def __init__(
        self,
        repo: AdminSubscriptionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        plan: str | None = None,
        status: str | None = None,
        search: str | None = None,
        has_scheduled_downgrade: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[dict], int]:
        # return
        return await self.repo.list_all_with_credit_with_page(
            plan=plan,
            status=status,
            search=search,
            has_scheduled_downgrade=has_scheduled_downgrade,
            page=page,
            size=size,
        )
