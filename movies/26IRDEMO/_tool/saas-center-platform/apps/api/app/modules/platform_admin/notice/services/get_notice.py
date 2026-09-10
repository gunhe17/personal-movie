from app.modules.notice.notice.models import Notice
from app.modules.platform_admin.notice.repository import NoticeRepository


class GetNoticeService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(self, notice_id: str) -> Notice:
        return await self.repo.get_active(notice_id)
