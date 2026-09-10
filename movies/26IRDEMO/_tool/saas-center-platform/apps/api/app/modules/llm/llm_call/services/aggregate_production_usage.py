from datetime import datetime

from ..repository import LlmCallRepository


class AggregateProductionUsageService:
    def __init__(self, repo: LlmCallRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[dict, list[dict]]:
        # return
        return await self.repo.get_production_cost_summary(
            date_from=date_from,
            date_to=date_to,
        )
