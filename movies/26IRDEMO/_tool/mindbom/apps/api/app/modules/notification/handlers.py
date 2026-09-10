"""알림 Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.unit_of_work import UnitOfWork
from app.modules.notification.facade import NotificationFacade
from app.modules.notification.schemas import (
    MarkReadResponse,
    NotificationListResponse,
    UnreadCountResponse,
)


async def handle_list_notifications(
    institution_id: str,
    recipient_member_id: str,
    uow: UnitOfWork,
    *,
    page: int = 1,
    size: int = 20,
    unread_only: bool = False,
) -> NotificationListResponse:
    async with uow:
        return await NotificationFacade(uow).list_notifications(
            institution_id, recipient_member_id,
            page=page, size=size, unread_only=unread_only,
        )


async def handle_unread_count(
    institution_id: str,
    recipient_member_id: str,
    uow: UnitOfWork,
) -> UnreadCountResponse:
    async with uow:
        return await NotificationFacade(uow).get_unread_count(
            institution_id, recipient_member_id
        )


async def handle_mark_read(
    institution_id: str,
    recipient_member_id: str,
    notification_id: str,
    uow: UnitOfWork,
) -> MarkReadResponse:
    async with uow:
        result = await NotificationFacade(uow).mark_read(
            institution_id, recipient_member_id, notification_id
        )
        await uow.commit()
        return result


async def handle_mark_all_read(
    institution_id: str,
    recipient_member_id: str,
    uow: UnitOfWork,
) -> MarkReadResponse:
    async with uow:
        result = await NotificationFacade(uow).mark_all_read(
            institution_id, recipient_member_id
        )
        await uow.commit()
        return result
