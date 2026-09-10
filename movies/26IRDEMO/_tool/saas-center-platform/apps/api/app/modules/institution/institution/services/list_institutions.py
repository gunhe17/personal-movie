from app.infrastructure.persistence.new_repository import Page

from ..models import Institution
from ..repository import InstitutionRepository


class ListInstitutionsService:
    def __init__(self, repo: InstitutionRepository):
        self.repo = repo

    async def execute(
        self,
        keyword: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Institution], Page]:
        # return
        return await self.repo.list_with_page(
            keyword=keyword,
            page=page,
            size=size,
        )
