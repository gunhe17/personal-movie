from app.core.exceptions import EntityNotFoundException

from ..repository import NoticeRepository


class DeleteNoticeService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(self, notice_id: str) -> str:
        # 삭제된 공지사항 title 반환 (audit log용).
        notice = await self.repo.find_by_id(id=notice_id)
        if not notice:
            raise EntityNotFoundException(f"공지사항을 찾을 수 없습니다: {notice_id}")

        await self.repo.remove_by_id(id=notice_id)
        return notice.title
