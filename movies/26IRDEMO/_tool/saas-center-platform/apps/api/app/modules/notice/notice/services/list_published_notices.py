from datetime import date

from ..repository import NoticeRepository


class ListPublishedNoticesService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        date_from: date | None = None,
        page: int = 1,
        size: int = 20,
    ):
        # return
        return await self.repo.list_published_with_page(
            search=search,
            category=category,
            date_from=date_from,
            page=page,
            size=size,
        )
