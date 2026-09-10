from ..repository import FieldNoteRepository
from ..models import FieldNote


class GetPreviousSummariesService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        schedule_ids: list[str],
        center_id: str,
        *,
        limit: int = 3,
    ) -> list[FieldNote]:
        # return
        return await self.repo.list_completed_with_summary_by_schedule_ids_in_center(
            schedule_ids=schedule_ids,
            center_id=center_id,
            limit=limit,
        )
