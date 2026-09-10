from datetime import datetime

from ..repository import LlmCallRepository


class AggregateDailyPurposeUsageService:
    def __init__(
        self,
        repo: LlmCallRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[dict]:
        # return
        return await self.repo.get_daily_purpose_breakdown(
            center_id=center_id,
            date_from=date_from,
            date_to=date_to,
        )
