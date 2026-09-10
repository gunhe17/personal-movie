from app.core.type import unset
from ..events import CounselingNoteAtomic
from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class UpdateNoteByIdService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        *,
        note_id: str,
        center_id: str,
        changed: dict | None = None,
        content: dict | None = None,
        summary: str | None = None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # load
        await self.note_repo.get_in_center(note_id=note_id, center_id=center_id)

        # save
        updated = await self.note_repo.update_in_center(
            note_id=note_id,
            center_id=center_id,
            content=content if content is not None else unset,
            summary=summary if summary is not None else unset,
        )
        assert updated is not None
        return CounselingNoteAtomic.updated(note=updated, changed=changed)
