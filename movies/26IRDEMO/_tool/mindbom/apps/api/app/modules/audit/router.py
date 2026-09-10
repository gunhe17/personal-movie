"""감사추적 Router — SaMD 2등급 (admin 전용)"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import InstitutionContext, require_role
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.audit.handlers import handle_list_audit_logs
from app.modules.audit.schemas import AuditLogListResponse

router = APIRouter(
    prefix="/institutions/{institution_id}/audit-logs",
    tags=["audit"],
)


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    ctx: InstitutionContext = Depends(require_role("admin")),
    uow: UnitOfWork = Depends(get_uow),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    action: str | None = Query(None),
    actor_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
):
    return await handle_list_audit_logs(
        ctx.institution_id, uow,
        page=page, size=size,
        entity_type=entity_type, entity_id=entity_id,
        action=action, actor_id=actor_id,
        date_from=date_from, date_to=date_to,
    )
