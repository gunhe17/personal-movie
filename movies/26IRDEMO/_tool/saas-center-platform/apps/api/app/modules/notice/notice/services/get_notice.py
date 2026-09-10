from app.core.exceptions import EntityNotFoundException

from ..models import Notice
from ..repository import NoticeRepository


class GetNoticeService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        notice_id: str,
        member_id: str | None,
        center_id: str | None,
    ) -> tuple[Notice, Notice | None, Notice | None]:
        # load
        notice = await self.repo.find_published(notice_id)
        if not notice:
            raise EntityNotFoundException(f"공지사항을 찾을 수 없습니다: {notice_id}")

        # track
        if member_id and center_id:
            await self.repo.upsert_read(
                notice_id=notice_id,
                center_id=center_id,
                member_id=member_id,
            )

        # return
        prev_notice, next_notice = await self.repo.find_siblings(
            notice_id=notice_id,
            is_pinned=notice.is_pinned,
            published_at=notice.published_at,
            created_at=notice.created_at,
        )
        return notice, prev_notice, next_notice
