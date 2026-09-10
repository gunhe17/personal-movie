from ..repository import LlmCallRepository


class AggregateUsageBySourceService:
    def __init__(self, repo: LlmCallRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        source_type: str,
        source_id: str,
    ) -> list[dict]:
        # return
        return await self.repo.aggregate_by_source(
            source_type=source_type,
            source_id=source_id,
        )
