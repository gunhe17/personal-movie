from ..repository import FieldNoteRepository
from ..models import FieldNote


class GetFieldNoteStatusesService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        schedule_ids: list[str],
        center_id: str,
    ) -> list[FieldNote]:
        # return
        return await self.repo.list_statuses_by_schedule_ids_in_center(
            schedule_ids=schedule_ids,
            center_id=center_id,
        )
