from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
)
from app.core.permissions import Permission

from app.application.handlers.activity import list_activity_handler
from app.application.handlers.activity.schemas import ActivityLogListResponse

router = APIRouter(
    prefix="/centers/{center_id}/activity-logs",
    tags=["ActivityLog"],
)


@router.get("", response_model=ActivityLogListResponse)
async def list_activity_logs(
    center_id: str,
    category: str | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    actor_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ACTIVITY_LOG),
        )
    ),
):
    # §4-B: event_atomics 기반 live read. 과거 activity_logs 행은 안 보임(§10).
    return await list_activity_handler(
        uow=ctx.uow,
        center_id=center_id,
        category=category,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )
