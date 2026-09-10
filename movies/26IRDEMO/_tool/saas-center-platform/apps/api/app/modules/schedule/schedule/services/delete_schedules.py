from ..events import ScheduleAtomic
from ..repository import ScheduleRepository


class DeleteSchedulesService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self, schedule_ids: list[str]
    ) -> tuple[list[ScheduleAtomic], int]:
        # remove
        removed = await self.repo.remove_by_ids(schedule_ids)

        # return
        atomics: list[ScheduleAtomic] = []
        for schedule in removed:
            atomic, _ = ScheduleAtomic.deleted(schedule=schedule)
            atomics.append(atomic)
        return atomics, len(removed)
