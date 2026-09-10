from app.core.type import unset
from ..events import CounselingNoteAtomic
from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class UpdateNoteService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        *,
        session_id: str,
        client_id: str,
        center_id: str,
        content: dict | None = None,
        summary: str | None = None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # load
        note = await self.note_repo.get_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )

        # save
        updated = await self.note_repo.update_in_center(
            note_id=note.id,
            center_id=center_id,
            content=content if content is not None else unset,
            summary=summary if summary is not None else unset,
        )
        assert updated is not None

        # return
        changed = {
            k: v
            for k, v in (("content", content), ("summary", summary))
            if v is not None
        }
        return CounselingNoteAtomic.updated(note=updated, changed=changed)
