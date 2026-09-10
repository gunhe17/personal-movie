"""알림 Router — 본인 수신 알림만 조회/처리"""
from fastapi import APIRouter, Depends, Query

from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
)
from app.modules.notification.handlers import (
    handle_list_notifications,
    handle_mark_all_read,
    handle_mark_read,
    handle_unread_count,
)
from app.modules.notification.schemas import (
    MarkReadResponse,
    NotificationListResponse,
    UnreadCountResponse,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/me/notifications",
    tags=["notifications"],
)


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
):
    return await handle_list_notifications(
        ctx.institution_id, ctx.member_id, uow,
        page=page, size=size, unread_only=unread_only,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_unread_count(ctx.institution_id, ctx.member_id, uow)


@router.patch("/{notification_id}/read", response_model=MarkReadResponse)
async def mark_read(
    notification_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_mark_read(
        ctx.institution_id, ctx.member_id, notification_id, uow
    )


@router.post("/read-all", response_model=MarkReadResponse)
async def mark_all_read(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_mark_all_read(ctx.institution_id, ctx.member_id, uow)
