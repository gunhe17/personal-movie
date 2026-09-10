from app.core.exceptions import ConflictException
from ..events import CounselingNoteAtomic
from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class CreateNoteService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.note_repo = note_repo

    async def execute(
        self,
        *,
        session_id: str,
        client_id: str,
        center_id: str,
        author_id: str,
        content: dict,
        summary: str | None = None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # verify
        existing = await self.note_repo.find_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )
        if existing:
            raise ConflictException(
                f"Note already exists for session: {session_id}, client: {client_id}"
            )

        # return
        note = await self.note_repo.add(
            center_id=center_id,
            counseling_session_id=session_id,
            client_id=client_id,
            content=content,
            summary=summary,
            author_id=author_id,
        )
        return CounselingNoteAtomic.created(note=note)
