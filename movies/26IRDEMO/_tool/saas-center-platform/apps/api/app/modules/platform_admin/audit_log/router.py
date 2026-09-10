from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.behavior import behavior, UnscopedContext, authenticate_admin, require_role
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS

from .handlers import list_audit_logs_handler
from .schemas import AdminAuditLogListResponse

router = APIRouter(tags=["Admin - 감사 로그"])


@router.get(
    "",
    response_model=AdminAuditLogListResponse,
)
async def list_audit_logs(
    search: str | None = Query(None, description="내용/어드민 이메일 검색"),
    target_type: str | None = Query(None, description="대상 타입 필터"),
    admin_id: str | None = Query(None, description="특정 어드민 ID 필터"),
    date_from: datetime | None = Query(None, description="기간 시작 (UTC)"),
    date_to: datetime | None = Query(None, description="기간 종료 (UTC)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
        )
    ),
):
    return await list_audit_logs_handler(
        ctx.uow,
        search=search,
        target_type=target_type,
        admin_account_id=admin_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )
