from datetime import date

from app.infrastructure.persistence.new_repository import Page

from ..models import Notice
from ..repository import NoticeRepository


class ListNoticesService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        member_id: str | None,
        *,
        search: str | None = None,
        category: str | None = None,
        date_from: date | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notice], set[str], Page]:
        # load
        rows, meta = await self.repo.list_published_with_page(
            search=search,
            category=category,
            date_from=date_from,
            page=page,
            size=size,
        )

        # enrich
        read_notice_ids: set[str] = set()
        if member_id:
            notice_ids = [row.id for row in rows]
            read_notice_ids = await self.repo.list_read_notice_ids(
                notice_ids=notice_ids,
                member_id=member_id,
            )

        # return
        return rows, read_notice_ids, meta
