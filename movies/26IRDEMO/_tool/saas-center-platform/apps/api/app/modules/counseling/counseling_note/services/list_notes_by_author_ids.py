from ..repository import CounselingNoteRepository
from ..models import CounselingNote


class ListNotesByAuthorIdsService:
    def __init__(self, repo: CounselingNoteRepository):
        self.repo = repo

    async def execute(
        self,
        author_ids: list[str],
        center_id: str,
        keyword: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[CounselingNote]:
        return await self.repo.list_by_author_ids(
            author_ids=author_ids,
            center_id=center_id,
            keyword=keyword,
            date_from=date_from,
            date_to=date_to,
        )
