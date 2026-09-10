from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class ListNotesBySessionService:
    def __init__(self, repo: CounselingNoteRepository):
        self.repo = repo

    async def execute(
        self,
        session_id: str,
        center_id: str,
        client_id: str | None = None,
        keyword: str | None = None,
        author_id: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[CounselingNote]:
        return await self.repo.list_by_session(
            session_id=session_id,
            center_id=center_id,
            client_id=client_id,
            keyword=keyword,
            author_id=author_id,
            date_from=date_from,
            date_to=date_to,
        )
