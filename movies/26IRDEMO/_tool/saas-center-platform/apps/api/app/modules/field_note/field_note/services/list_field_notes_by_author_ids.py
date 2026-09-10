from ..repository import FieldNoteRepository
from ..models import FieldNote


class ListFieldNotesByAuthorIdsService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        author_ids: list[str],
        center_id: str,
    ) -> list[FieldNote]:
        # return
        return await self.repo.list_by_author_ids_in_center(
            author_ids=author_ids,
            center_id=center_id,
        )
