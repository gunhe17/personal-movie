from ..repository import FieldNoteAudioRepository
from ..models import FieldNoteAudio


class ListAudiosService:
    def __init__(self, repo: FieldNoteAudioRepository):
        self.repo = repo

    async def execute(self, field_note_id: str) -> list[FieldNoteAudio]:
        # return
        return await self.repo.list_by_field_note(field_note_id=field_note_id)
