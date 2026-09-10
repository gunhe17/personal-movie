import json

from ..repository import FieldNoteRepository
from ..models import FieldNote
from ..events import FieldNoteAtomic


class UpdateSpeakerMapService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        speaker_map: dict[str, str],
        changed: dict,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # load
        await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # return
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            speaker_map=json.dumps(speaker_map, ensure_ascii=False),
        )
        return FieldNoteAtomic.updated(field_note=field_note, changed=changed)
