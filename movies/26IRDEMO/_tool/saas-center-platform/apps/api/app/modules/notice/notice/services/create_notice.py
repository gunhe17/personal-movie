from app.core.datetime_utils import utc_now

from ..models import Notice
from ..repository import NoticeRepository


class CreateNoticeService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        title: str,
        content: str,
        category: str,
        is_published: bool,
        is_pinned: bool,
        attachments: list[dict] | None,
        created_by: str,
    ) -> Notice:
        return await self.repo.add(
            title=title,
            content=content,
            category=category,
            is_published=is_published,
            is_pinned=is_pinned,
            published_at=utc_now() if is_published else None,
            created_by=created_by,
            attachments=attachments,
        )
