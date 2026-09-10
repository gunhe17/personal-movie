from datetime import date

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.schemas import DetailResponse
from app.modules.platform_admin.cs_memo.schemas import (
    CSMemoCreate,
    CSMemoUpdate,
    CSMemoBulkDelete,
    CSMemoBulkDeleteResponse,
    CSMemoDetailResponse,
    CSMemoListResponse,
)
from app.modules.platform_admin.cs_memo.handlers.list_memos import list_memos_handler
from app.modules.platform_admin.cs_memo.handlers.get_memo import get_memo_handler
from app.modules.platform_admin.cs_memo.handlers.create_memo import create_memo_handler
from app.modules.platform_admin.cs_memo.handlers.update_memo import update_memo_handler
from app.modules.platform_admin.cs_memo.handlers.delete_memo import delete_memo_handler
from app.modules.platform_admin.cs_memo.handlers.delete_memos import (
    delete_memos_handler,
)

router = APIRouter(tags=["Admin - CS 전화 메모"])


@router.get("/", response_model=CSMemoListResponse)
async def list_memos(
    search: str | None = Query(default=None, description="제목/내용 검색"),
    memo_type: str | None = Query(
        default=None, description="유형 필터 (inquiry, complaint, request, other)"
    ),
    center_id: str | None = Query(default=None, description="센터 필터"),
    date_from: date | None = Query(default=None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="종료 날짜 (YYYY-MM-DD)"),
    sort_order: str = Query(default="desc", description="날짜 정렬 (asc, desc)"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_memos_handler(
        ctx.uow,
        actor_id=ctx.admin_account_id,
        actor_role=ctx.role,
        search=search,
        memo_type=memo_type,
        center_id=center_id,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
        page=page,
        size=size,
    )


@router.get("/{memo_id}", response_model=CSMemoDetailResponse)
async def get_memo(
    memo_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_memo_handler(
        memo_id,
        ctx.uow,
        actor_id=ctx.admin_account_id,
        actor_role=ctx.role,
    )


@router.post("/", response_model=CSMemoDetailResponse, status_code=201)
async def create_memo(
    data: CSMemoCreate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_memo_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.patch("/{memo_id}", response_model=CSMemoDetailResponse)
async def update_memo(
    memo_id: str,
    data: CSMemoUpdate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_memo_handler(
        memo_id=memo_id,
        data=data,
        actor_id=ctx.admin_account_id,
        actor_role=ctx.role,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete("/batch", response_model=CSMemoBulkDeleteResponse)
async def delete_memos(
    data: CSMemoBulkDelete,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_memos_handler(
        memo_ids=data.memo_ids,
        actor_id=ctx.admin_account_id,
        actor_role=ctx.role,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete("/{memo_id}", response_model=DetailResponse)
async def delete_memo(
    memo_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_memo_handler(
        memo_id=memo_id,
        actor_id=ctx.admin_account_id,
        actor_role=ctx.role,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
