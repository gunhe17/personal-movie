from ..repository import CounselingSessionRepository


class AggregateActiveCaseMapByScheduleIdsService:
    def __init__(self, repository: CounselingSessionRepository):
        self.repository = repository

    async def execute(self, schedule_ids: list[str]) -> dict[str, str]:
        if not schedule_ids:
            return {}

        return await self.repository.aggregate_active_case_map_by_schedule_ids(
            schedule_ids=schedule_ids,
        )
