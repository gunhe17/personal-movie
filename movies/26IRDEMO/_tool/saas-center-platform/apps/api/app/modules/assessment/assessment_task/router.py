from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from app.core.schemas import MessageResponse
from app.infrastructure.storage import get_storage_client
from app.application.handlers.assessment.delete_assessment_task import (
    delete_assessment_task_handler,
)
from app.application.handlers.assessment.submit_task import submit_task_handler
from .handlers import (
    list_tasks_handler,
    get_task_handler,
    start_task_handler,
    complete_task_handler,
    revert_task_handler,
    refuse_task_handler,
    cancel_task_handler,
    revert_cancel_task_handler,
    update_task_opinion_handler,
)
from .schemas import (
    TaskResponse,
    TaskSubmitData,
    TaskRefuse,
    TaskCancel,
    TaskOpinionUpdate,
)

router = APIRouter(prefix="/centers/{center_id}", tags=["AssessmentTask"])


@router.get(
    "/assessment-cases/{case_id}/tasks",
    response_model=list[TaskResponse],
)
async def list_tasks(
    case_id: str,
    execution_method: str | None = Query(
        None, description="실시 방식 필터 (onsite, online)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await list_tasks_handler(ctx.center_id, case_id, execution_method, ctx.uow)


@router.get(
    "/tasks/{task_id}",
    response_model=TaskResponse,
)
async def get_task(
    task_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await get_task_handler(
        task_id,
        ctx.center_id,
        ctx.uow,
    )


@router.post(
    "/tasks/{task_id}/start",
    response_model=TaskResponse,
)
async def start_task(
    task_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await start_task_handler(
        task_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/tasks/{task_id}/submit",
    response_model=TaskResponse,
)
async def submit_task(
    task_id: str,
    data: TaskSubmitData,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await submit_task_handler(
        task_id,
        ctx.center_id,
        data,
        get_storage_client(),
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/assessment-cases/{case_id}/tasks/{assessment_id}/complete",
    response_model=TaskResponse,
)
async def complete_task(
    case_id: str,
    assessment_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await complete_task_handler(
        ctx.center_id,
        case_id,
        assessment_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/assessment-cases/{case_id}/tasks/{assessment_id}/revert",
    response_model=TaskResponse,
)
async def revert_task(
    case_id: str,
    assessment_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await revert_task_handler(
        ctx.center_id,
        case_id,
        assessment_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/tasks/{task_id}/refuse",
    response_model=TaskResponse,
)
async def refuse_task(
    task_id: str,
    data: TaskRefuse,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await refuse_task_handler(
        event_group_id=ctx.event_group_id,
        task_id=task_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/tasks/{task_id}/cancel",
    response_model=TaskResponse,
)
async def cancel_task(
    task_id: str,
    data: TaskCancel,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await cancel_task_handler(
        event_group_id=ctx.event_group_id,
        task_id=task_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.delete(
    "/tasks/{task_id}",
    response_model=MessageResponse,
)
async def delete_task(
    task_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await delete_assessment_task_handler(
        task_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/tasks/{task_id}/revert-cancel",
    response_model=TaskResponse,
)
async def revert_cancel_task(
    task_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await revert_cancel_task_handler(
        task_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.patch(
    "/tasks/{task_id}/opinion",
    response_model=TaskResponse,
    description="opinion 빈 값/null이면 기존 소견을 해제합니다.",
)
async def update_task_opinion(
    task_id: str,
    data: TaskOpinionUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await update_task_opinion_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        task_id=task_id,
        opinion=data.opinion,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )
