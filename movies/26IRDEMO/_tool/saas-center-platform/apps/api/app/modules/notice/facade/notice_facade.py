from app.core.type import unset
from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..notice.models import Notice
from ..notice.repository import NoticeRepository
from ..notice.schemas import NoticeCreate, NoticeUpdate
from ..notice.services.create_notice import CreateNoticeService
from ..notice.services.get_notice import GetNoticeService
from ..notice.services.list_notices import ListNoticesService
from ..notice.services.update_notice import UpdateNoticeService
from ..notice.services.delete_notice import DeleteNoticeService


class NoticeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_notice_detail(
        self,
        notice_id: str,
        member_id: str | None,
        center_id: str | None,
    ) -> tuple[Notice, Notice | None, Notice | None]:
        return await GetNoticeService(self._uow.repo(NoticeRepository)).execute(
            notice_id,
            member_id,
            center_id,
        )

    async def list_notices(
        self,
        member_id: str | None,
        *,
        search: str | None = None,
        category: str | None = None,
        date_from=None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Notice], set[str], Page]:
        return await ListNoticesService(self._uow.repo(NoticeRepository)).execute(
            member_id,
            search=search,
            category=category,
            date_from=date_from,
            page=page,
            size=size,
        )

    async def create_notice(
        self, data: NoticeCreate, created_by: str
    ) -> Notice:
        return await CreateNoticeService(self._uow.repo(NoticeRepository)).execute(
            title=data.title,
            content=data.content,
            category=data.category.value,
            is_published=data.is_published,
            is_pinned=data.is_pinned,
            attachments=[a.model_dump() for a in data.attachments] if data.attachments else None,
            created_by=created_by,
        )

    async def update_notice(
        self, notice_id: str, data: NoticeUpdate
    ) -> tuple[Notice, bool]:
        update_data = data.model_dump(exclude_unset=True)
        return await UpdateNoticeService(self._uow.repo(NoticeRepository)).execute(
            notice_id=notice_id,
            title=update_data.get("title", unset),
            content=update_data.get("content", unset),
            category=update_data["category"].value if update_data.get("category") is not None else unset,
            is_published=update_data.get("is_published", unset),
            is_pinned=update_data.get("is_pinned", unset),
            attachments=update_data.get("attachments", unset),
        )

    async def delete_notice(self, notice_id: str) -> str:
        return await DeleteNoticeService(self._uow.repo(NoticeRepository)).execute(
            notice_id
        )
