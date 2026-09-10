from fastapi import APIRouter, Depends, Query

from app.application.handlers.care_board import (
    create_care_memo_handler,
    delete_care_memo_handler,
    list_care_board_stream_handler,
    mark_care_board_read_handler,
    rebuild_care_board_handler,
    toggle_care_board_pin_handler,
    update_care_memo_handler,
)
from app.behavior import (
    ServerContext,
    authenticate,
    behavior,
    dispatch_events,
    require_membership,
    require_permission,
    start_event_group,
)
from app.core.permissions import Permission

from .entry.schemas import CareBoardStreamResponse
from .memo.schemas import CareMemoCreate, CareMemoResponse, CareMemoUpdate

router = APIRouter(
    prefix="/centers/{center_id}/clients/{client_id}/care-board",
    tags=["CareBoard"],
)

# 관리자 판정 — 센터 전체를 보는 역할(access_level=all)이면 남의 메모도 고치고 지운다(§8)
def _is_manager(ctx: ServerContext) -> bool:
    return ctx.access_level == "all" or "*" in ctx.permissions


@router.get("/stream", response_model=CareBoardStreamResponse)
async def list_care_board_stream(
    client_id: str,
    kinds: list[str] | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_care_board_stream_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        member_id=ctx.actor_id,
        permissions=list(ctx.permissions),
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        kinds=kinds,
        cursor=cursor,
        limit=limit,
    )


@router.post("/read", status_code=204)
async def mark_care_board_read(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    await mark_care_board_read_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        member_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
    )


@router.post("/rebuild", status_code=200)
async def rebuild_care_board(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
        )
    ),
):
    recorded = await rebuild_care_board_handler(
        center_id=ctx.center_id, client_id=client_id, uow=ctx.uow
    )
    return {"recorded": recorded}


@router.post("/memos", status_code=201, response_model=CareMemoResponse)
async def create_care_memo(
    client_id: str,
    data: CareMemoCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            # 작성 게이트는 permission이 아니라 담당 관계다(§7-2) — 카탈로그 축은 READ_CLIENT로 유지
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await create_care_memo_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        member_id=ctx.actor_id,
        body=data.body,
        owner_scope=ctx.owner_scope,
        actor_id=ctx.actor_id,
        uow=ctx.uow,
    )


@router.patch("/memos/{memo_id}", response_model=CareMemoResponse)
async def update_care_memo(
    client_id: str,
    memo_id: str,
    data: CareMemoUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await update_care_memo_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        memo_id=memo_id,
        member_id=ctx.actor_id,
        body=data.body,
        is_manager=_is_manager(ctx),
        owner_scope=ctx.owner_scope,
        actor_id=ctx.actor_id,
        uow=ctx.uow,
    )


@router.delete("/memos/{memo_id}", status_code=204)
async def delete_care_memo(
    client_id: str,
    memo_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    await delete_care_memo_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        memo_id=memo_id,
        member_id=ctx.actor_id,
        is_manager=_is_manager(ctx),
        owner_scope=ctx.owner_scope,
        actor_id=ctx.actor_id,
        uow=ctx.uow,
    )


@router.post("/entries/{entry_id}/pin", status_code=204)
async def toggle_care_board_pin(
    client_id: str,
    entry_id: str,
    pinned: bool = Query(True),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    await toggle_care_board_pin_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        entry_id=entry_id,
        member_id=ctx.actor_id,
        pinned=pinned,
        owner_scope=ctx.owner_scope,
        actor_id=ctx.actor_id,
        uow=ctx.uow,
    )
