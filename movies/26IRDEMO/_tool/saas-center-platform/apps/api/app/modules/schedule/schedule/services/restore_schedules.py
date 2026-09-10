from ..events import ScheduleAtomic
from ..repository import ScheduleRepository


class RestoreSchedulesService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self, schedule_ids: list[str]
    ) -> tuple[list[ScheduleAtomic], int]:
        # restore
        restored = await self.repo.restore_by_ids(schedule_ids)

        # return
        atomics: list[ScheduleAtomic] = []
        for schedule in restored:
            atomic, _ = ScheduleAtomic.restored(schedule=schedule)
            atomics.append(atomic)
        return atomics, len(restored)
