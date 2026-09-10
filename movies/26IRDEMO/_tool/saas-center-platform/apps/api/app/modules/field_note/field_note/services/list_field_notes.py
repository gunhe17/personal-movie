from app.infrastructure.persistence.new_repository import Page
from ..repository import FieldNoteRepository
from ..models import FieldNote


class ListFieldNotesService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        status: str | None = None,
        processing_status: str | None = None,
        analysis_state: str | None = None,
        linked: bool | None = None,
        link_type: str | None = None,
        author_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[FieldNote], Page]:
        # return
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            status=status,
            processing_status=processing_status,
            analysis_state=analysis_state,
            linked=linked,
            link_type=link_type,
            author_id=author_id,
            page=page,
            size=size,
        )
