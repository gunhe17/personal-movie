from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset

from ..models import Notice
from ..repository import NoticeRepository


class UpdateNoticeService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        notice_id: str,
        title: str = unset,
        content: str = unset,
        category: str = unset,
        is_published: bool = unset,
        is_pinned: bool = unset,
        attachments: list[dict] = unset,
    ) -> tuple[Notice, bool]:
        # load
        notice = await self.repo.find_by_id(id=notice_id)
        if not notice:
            raise EntityNotFoundException(f"공지사항을 찾을 수 없습니다: {notice_id}")

        # 초안 → 게시 전환 감지 (최초 1회만 알림 발송)
        becomes_published = is_published is not unset and is_published and not notice.is_published
        is_publishing = becomes_published and notice.published_at is None
        published_at = utc_now() if becomes_published else unset

        updated = await self.repo.update_in_place(
            id=notice_id,
            title=title,
            content=content,
            category=category,
            is_published=is_published,
            is_pinned=is_pinned,
            published_at=published_at,
            attachments=attachments,
        )

        return updated, is_publishing
