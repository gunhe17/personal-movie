from app.infrastructure.persistence.new_repository import Page
from app.modules.notice.notice.models import Notice
from app.modules.platform_admin.notice.repository import NoticeRepository


class ListNoticesService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        category: str | None = None,
        is_published: bool | None = None,
        search: str | None = None,
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notice], dict[str, int], int, Page]:
        rows, page_meta = await self.repo.list_notices_with_page(
            category=category,
            is_published=is_published,
            search=search,
            sort_order=sort_order,
            page=page,
            size=size,
        )

        # 조회수 집계 + 전체 대상 멤버 수
        notice_ids = [row.id for row in rows]
        read_counts = await self.repo.aggregate_read_counts(notice_ids=notice_ids)
        target_count = await self.repo.count_target_members()

        return rows, read_counts, target_count, page_meta
