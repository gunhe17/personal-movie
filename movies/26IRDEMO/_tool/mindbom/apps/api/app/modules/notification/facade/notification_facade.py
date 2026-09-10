"""Notification Facade — Service 조합 + DTO 변환"""
from app.core.unit_of_work import UnitOfWork
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.schemas import (
    MarkReadResponse,
    NotificationListResponse,
    UnreadCountResponse,
)
from app.modules.notification.services import (
    GetUnreadCountService,
    ListNotificationsService,
    MarkAllAsReadService,
    MarkAsReadService,
)


class NotificationFacade:
    """알림 도메인 — Service 조합 + DTO 변환"""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    @property
    def _repo(self) -> NotificationRepository:
        return self._uow.repo(NotificationRepository)

    async def list_notifications(
        self,
        institution_id: str,
        recipient_member_id: str,
        *,
        page: int = 1,
        size: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        return await ListNotificationsService(self._repo).execute(
            institution_id, recipient_member_id,
            page=page, size=size, unread_only=unread_only,
        )

    async def get_unread_count(
        self, institution_id: str, recipient_member_id: str
    ) -> UnreadCountResponse:
        count = await GetUnreadCountService(self._repo).execute(
            institution_id, recipient_member_id
        )
        return UnreadCountResponse(unread_count=count)

    async def mark_read(
        self,
        institution_id: str,
        recipient_member_id: str,
        notification_id: str,
    ) -> MarkReadResponse:
        updated = await MarkAsReadService(self._repo).execute(
            institution_id, recipient_member_id, notification_id
        )
        return MarkReadResponse(updated=updated)

    async def mark_all_read(
        self, institution_id: str, recipient_member_id: str
    ) -> MarkReadResponse:
        updated = await MarkAllAsReadService(self._repo).execute(
            institution_id, recipient_member_id
        )
        return MarkReadResponse(updated=updated)
