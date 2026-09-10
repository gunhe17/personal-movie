from ..repository import FieldNoteEntryRepository
from ..models import FieldNoteEntry


class ListEntriesService:
    def __init__(self, repo: FieldNoteEntryRepository):
        self.repo = repo

    async def execute(self, field_note_id: str) -> list[FieldNoteEntry]:
        # return
        return await self.repo.list_by_field_note(field_note_id=field_note_id)
