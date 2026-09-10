from datetime import datetime

from ..repository import LlmCallRepository


class AggregateCenterUsageService:
    def __init__(self, repo: LlmCallRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[dict, list[dict], list[dict]]:
        # return
        return await self.repo.get_center_usage_summary(
            center_id=center_id,
            date_from=date_from,
            date_to=date_to,
        )
