from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class ListNotesByClientService:
    def __init__(self, repo: CounselingNoteRepository):
        self.repo = repo

    async def execute(
        self,
        client_id: str,
        center_id: str,
        keyword: str | None = None,
        author_id: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[CounselingNote]:
        return await self.repo.list_by_client(
            client_id=client_id,
            center_id=center_id,
            keyword=keyword,
            author_id=author_id,
            date_from=date_from,
            date_to=date_to,
        )
