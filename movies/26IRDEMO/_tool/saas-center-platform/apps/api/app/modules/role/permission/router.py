from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    UnscopedContext,
    authenticate,
)
from .handlers import list_permissions_handler
from .schemas import PermissionSummary

router = APIRouter(prefix="/role/permissions", tags=["permission"])


@router.get(
    "/",
    response_model=list[PermissionSummary],
)
async def list_permissions(
    category: str | None = Query(None, description="카테고리 필터"),
    is_new: bool | None = Query(None, description="신규 권한만 조회"),
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await list_permissions_handler(category, is_new, ctx.uow)


