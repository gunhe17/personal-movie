from ..repository import FieldNoteRepository
from ..models import FieldNote


class FindFieldNoteByScheduleService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        schedule_id: str,
        center_id: str,
    ) -> FieldNote | None:
        # return
        return await self.repo.find_by_schedule_in_center(
            schedule_id=schedule_id,
            center_id=center_id,
        )
