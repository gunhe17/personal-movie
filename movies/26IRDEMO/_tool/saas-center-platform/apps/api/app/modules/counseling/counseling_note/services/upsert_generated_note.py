from ..events import CounselingNoteAtomic
from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class UpsertGeneratedNoteService:
    def __init__(self, note_repo: CounselingNoteRepository):
        self.repo = note_repo

    async def execute(
        self,
        session_id: str,
        client_id: str,
        center_id: str,
        author_id: str,
        content: dict,
        summary: str | None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # load
        existing = await self.repo.find_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )

        # update
        if existing:
            updated = await self.repo.update_in_center(
                note_id=existing.id,
                center_id=center_id,
                content=content,
                summary=summary,
            )
            assert updated is not None
            return CounselingNoteAtomic.updated(
                note=updated,
                changed={"content": content, "summary": summary},
            )

        # create
        created = await self.repo.add(
            center_id=center_id,
            counseling_session_id=session_id,
            client_id=client_id,
            content=content,
            summary=summary,
            author_id=author_id,
        )
        return CounselingNoteAtomic.created(note=created)
