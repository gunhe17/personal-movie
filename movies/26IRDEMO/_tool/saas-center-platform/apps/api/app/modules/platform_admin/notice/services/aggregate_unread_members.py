from app.modules.platform_admin.notice.repository import NoticeRepository


class AggregateUnreadMembersService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        notice_id: str,
    ) -> list[tuple[str, str]]:
        # return
        return await self.repo.aggregate_unread_members_all(notice_id=notice_id)
