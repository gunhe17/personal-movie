from datetime import date

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

# Application Layer Handler - 직접 파일 import (순환 참조 방지)
from app.application.handlers.assessment.create_batch_assessment import (
    create_batch_assessment_handler,
)
from app.application.handlers.assessment.create_individual_assessment import (
    create_individual_assessment_handler,
)
from app.application.handlers.assessment.list_cases import list_cases_handler
from app.application.handlers.assessment.list_cases_by_client import (
    list_cases_by_client_handler,
)
from app.application.handlers.assessment.get_case import get_case_handler
from app.application.handlers.assessment.update_assessment_case import (
    update_assessment_case_handler,
)
from app.application.handlers.assessment.cancel_assessment_case import (
    cancel_assessment_case_handler,
)
from app.application.handlers.assessment.delete_assessment_case import (
    delete_assessment_case_handler,
)
from app.application.handlers.assessment.revert_cancel_case import (
    revert_cancel_case_handler,
)
from app.application.schemas import (
    IndividualAssessmentCreate,
    IndividualAssessmentResponse,
    BatchAssessmentCreate,
    BatchAssessmentResponse,
    AssessmentCaseListResponse,
    AssessmentCaseListItem,
    AssessmentCaseDetailResponse,
)
from .handlers import (
    complete_assessment_case_handler,
)
from .schemas import (
    AssessmentCaseUpdate,
    AssessmentCaseResponse,
    AssessmentCaseUpdateResponse,
)

router = APIRouter(prefix="/centers/{center_id}/assessment-cases", tags=["AssessmentCase"])


@router.get(
    "",
    response_model=AssessmentCaseListResponse,
)
async def list_assessment_cases(
    status: str | None = Query(
        None, description="상태 필터 (pending|processing|completed|cancelled)"
    ),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    counselor_id: str | None = Query(
        None, description="담당 검사자 ID (manage 권한 전용)"
    ),
    search: str | None = Query(None, description="검색어 (이름, 케이스 코드)"),
    sort: str = Query("desc", description="정렬 (asc|desc)"),
    case_type: str | None = Query(None, description="개인/단체 (individual|group)"),
    date_from: date | None = Query(None, description="접수일 시작 (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="접수일 종료 (YYYY-MM-DD)"),
    has_schedule: bool | None = Query(
        None, description="세션(일정) 존재 필터 (true=있는 것만, false=없는 것만)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    # 담당자 드롭다운 필터는 access_level=all 전용, 본인 열람 범위는 owner_scope가 강제
    return await list_cases_handler(
        ctx.center_id,
        counselor_id if ctx.owner_scope is None else None,
        status,
        page,
        size,
        ctx.uow,
        search=search,
        sort_order=sort,
        case_type=case_type,
        date_from=date_from,
        date_to=date_to,
        has_schedule=has_schedule,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/{case_id}",
    response_model=AssessmentCaseDetailResponse,
)
async def get_assessment_case(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await get_case_handler(
        ctx.center_id,
        case_id,
        ctx.uow,
        owner_scope=ctx.owner_scope,
        actor_membership_id=ctx.actor_id,
    )


@router.post(
    "/individual",
    response_model=IndividualAssessmentResponse,
    status_code=201,
)
async def create_individual_assessment(
    data: IndividualAssessmentCreate,
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
    return await create_individual_assessment_handler(
        ctx.center_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.post(
    "/batch",
    response_model=BatchAssessmentResponse,
    status_code=201,
)
async def create_batch_assessment(
    data: BatchAssessmentCreate,
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
    return await create_batch_assessment_handler(
        ctx.center_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{case_id}",
    response_model=AssessmentCaseUpdateResponse,
)
async def update_assessment_case(
    case_id: str,
    data: AssessmentCaseUpdate,
    force: bool = Query(
        False, description="실제 수정 여부 (false: 검증만, true: 실제 수정)"
    ),
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
    return await update_assessment_case_handler(
        ctx.center_id,
        case_id,
        data,
        force,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/{case_id}/complete",
    response_model=AssessmentCaseResponse,
)
async def complete_assessment_case(
    case_id: str,
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
    return await complete_assessment_case_handler(
        ctx.center_id,
        case_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/{case_id}/cancel",
    response_model=AssessmentCaseResponse,
)
async def cancel_assessment_case(
    case_id: str,
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
    return await cancel_assessment_case_handler(
        ctx.center_id,
        case_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.delete(
    "/{case_id}",
    response_model=MessageResponse,
)
async def delete_assessment_case(
    case_id: str,
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
    return await delete_assessment_case_handler(
        ctx.center_id,
        case_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.post(
    "/{case_id}/revert-cancel",
    response_model=AssessmentCaseResponse,
)
async def revert_cancel_case(
    case_id: str,
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
    return await revert_cancel_case_handler(
        ctx.center_id,
        case_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
    )


@router.get(
    "/by-client/{client_id}",
    response_model=list[AssessmentCaseListItem],
)
async def get_cases_by_client(
    client_id: str,
    status: str | None = Query(
        None,
        description="상태 필터 (pending|processing|completed|cancelled, 쉼표로 여러개 가능)",
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    status_list = [s.strip() for s in status.split(",")] if status else None

    # access_level=all(관리자) → 전체, read:assessment(상담사) → 열람 범위(주담당+참여 검사자)만
    return await list_cases_by_client_handler(
        center_id=ctx.center_id,
        client_id=client_id,
        uow=ctx.uow,
        status=status_list,
        owner_scope=ctx.owner_scope,
    )
