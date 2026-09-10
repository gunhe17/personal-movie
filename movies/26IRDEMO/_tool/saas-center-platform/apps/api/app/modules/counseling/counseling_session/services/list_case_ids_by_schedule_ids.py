from ..repository import CounselingSessionRepository


class ListCaseIdsByScheduleIdsService:
    def __init__(self, repository: CounselingSessionRepository):
        self.repository = repository

    async def execute(self, schedule_ids: list[str]) -> list[str]:
        if not schedule_ids:
            return []

        return await self.repository.list_case_ids_by_schedule_ids(
            schedule_ids=schedule_ids,
        )
