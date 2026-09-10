from ..repository import FieldNoteRepository
from ..models import FieldNote


class FindFieldNoteService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
    ) -> FieldNote | None:
        # return
        return await self.repo.find_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )
