from ..repository import ScheduleRepository


class ListScheduleIdsByDateRangeService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        schedule_type: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[str]:
        return await self.repo.list_ids_by_date_range(
            center_id=center_id,
            schedule_type=schedule_type,
            start_date=start_date,
            end_date=end_date,
        )
