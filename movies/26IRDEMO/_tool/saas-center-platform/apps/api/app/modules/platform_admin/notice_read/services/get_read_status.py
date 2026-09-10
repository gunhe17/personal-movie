from app.modules.platform_admin.notice_read.repository import NoticeReadRepository


class GetReadStatusService:
    def __init__(
        self,
        repo: NoticeReadRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        notice_id: str,
        *,
        search: str | None = None,
        is_read: bool | None = None,
        page: int = 1,
        size: int = 10,
    ) -> tuple[list[dict], int]:
        return await self.repo.aggregate_read_status_by_notice(
            notice_id=notice_id,
            search=search,
            is_read=is_read,
            page=page,
            size=size,
        )
