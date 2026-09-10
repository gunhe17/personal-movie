from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import NoticeRepository
from .services.aggregate_unread_members import AggregateUnreadMembersService
from .services.get_notice import GetNoticeService
from .services.prepare_notice_remind import REMIND_ACTS, PrepareNoticeRemindService

__all__ = ["AdminNoticeFacade", "REMIND_ACTS"]


class AdminNoticeFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def get_notice(
        self,
        notice_id: str,
    ):
        # 반환 = notice read-model 행(EX-2) — 타입 전파 없이 서비스 반환 그대로
        return await GetNoticeService(self._uow.repo(NoticeRepository)).execute(notice_id)

    async def aggregate_unread_members(
        self,
        notice_id: str,
    ) -> list[tuple[str, str]]:
        return await AggregateUnreadMembersService(
            self._uow.repo(NoticeRepository)
        ).execute(notice_id)

    async def prepare_remind(
        self,
        notice_id: str,
        *,
        last_remind_at: datetime | None = None,
    ) -> tuple[str, int]:
        return await PrepareNoticeRemindService(
            self._uow.repo(NoticeRepository)
        ).execute(notice_id, last_remind_at=last_remind_at)
