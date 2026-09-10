from ..repository import FieldNoteRepository
from ..models import FieldNote


class ListUnlinkedService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        author_id: str | None = None,
        analysis_state: str | None = None,
    ) -> list[FieldNote]:
        # return
        return await self.repo.list_unlinked_in_center(
            center_id=center_id,
            author_id=author_id,
            analysis_state=analysis_state,
        )
