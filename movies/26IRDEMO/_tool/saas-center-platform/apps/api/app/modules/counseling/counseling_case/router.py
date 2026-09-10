from app.behavior import (
    start_event_group,
    dispatch_events,
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from app.application.schemas import (
    CounselingCaseListResponse,
    CounselingCaseDetailResponse,
    MyCounselingResponse,
)
from .schemas import (
    CaseStatus,
)
from .handlers import (
    add_counseling_participant_handler,
    leave_participant_handler,
    list_counseling_participants_handler,
)
from ..counseling_case_participant.schemas import (
    CounselingCaseParticipantCreate,
    CounselingCaseParticipantResponse,
    CounselingCaseParticipantListResponse,
)

from app.application.handlers.counseling.schemas import CaseWithSessionsCreate, CaseWithSessionsResponse
from app.application.schemas import ApplyCaseEditsRequest, ApplyCaseEditsResponse
from .schemas import (
    CounselingCaseUpdateWithReschedule,
    ValidateUpdateRequest,
    ValidateUpdateResponse,
    CounselingCaseResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}/counseling", tags=["Counseling - Cases"]
)


@router.get(
    "/",
    response_model=CounselingCaseListResponse,
)
async def list_counseling_cases(
    status: CaseStatus | None = None,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    client_name: str | None = Query(None, description="내담자 이름 검색"),
    client_id: str | None = Query(
        None, description="내담자 ID 필터 (상세페이지 이력용)"
    ),
    counseling_type: str | None = Query(
        None, description="상담 유형 (individual | group)"
    ),
    counselor_id: str | None = Query(
        None, description="담당 상담사 ID (manage 권한 전용)"
    ),
    start_date: str | None = Query(
        None, description="세션 일정 시작 필터 (YYYY-MM-DD)"
    ),
    end_date: str | None = Query(None, description="세션 일정 종료 필터 (YYYY-MM-DD)"),
    sort: str = Query("desc", description="정렬 방향 (asc | desc)"),
    signal: str | None = Query(
        None, description="시그널 필터 (unprocessed | needs_review)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from app.application.handlers.counseling import list_counseling_cases_enriched_handler

    # 담당자 드롭다운 필터는 access_level=all 전용, 본인 열람 범위는 owner_scope가 강제
    return await list_counseling_cases_enriched_handler(
        center_id=ctx.center_id,
        counselor_id=counselor_id if ctx.owner_scope is None else None,
        owner_scope=ctx.owner_scope,
        status=status.value if status else None,
        page=page,
        size=size,
        uow=ctx.uow,
        client_name=client_name,
        client_id=client_id,
        counseling_type=counseling_type,
        start_date=start_date,
        end_date=end_date,
        sort=sort,
        signal=signal,
    )


@router.get(
    "/me",
    response_model=MyCounselingResponse,
)
async def my_counseling_cases(
    status: CaseStatus | None = None,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    sort: str = Query("desc", description="정렬 방향 (asc | desc)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    from app.application.handlers.counseling import list_my_counseling_cases_handler

    return await list_my_counseling_cases_handler(
        center_id=ctx.center_id,
        counselor_id=ctx.actor_id,
        status=status.value if status else None,
        page=page,
        size=size,
        uow=ctx.uow,
        sort=sort,
    )


@router.get(
    "/{case_id}",
    response_model=CounselingCaseDetailResponse,
)
async def get_counseling_case(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from app.application.handlers.counseling import get_counseling_case_detail_handler

    return await get_counseling_case_detail_handler(
        case_id=case_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        actor_membership_id=ctx.actor_id,
    )


@router.post(
    "/{case_id}/participants",
    status_code=201,
    response_model=CounselingCaseParticipantResponse,
)
async def add_participant(
    case_id: str,
    data: CounselingCaseParticipantCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    return await add_counseling_participant_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{case_id}/participants",
    response_model=CounselingCaseParticipantListResponse,
)
async def list_participants(
    case_id: str,
    active_only: bool = Query(False, description="활성 참여자만 조회"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    return await list_counseling_participants_handler(
        case_id, ctx.center_id, ctx.owner_scope, active_only, ctx.uow
    )


@router.delete(
    "/{case_id}/participants/{participant_id}",
    status_code=204,
)
async def leave_participant(
    case_id: str,
    participant_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    await leave_participant_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        participant_id=participant_id,
        center_id=ctx.center_id,
        owner_scope=ctx.owner_scope,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/intake",
    response_model=CaseWithSessionsResponse,
    status_code=201,
)
async def intake_case(
    data: CaseWithSessionsCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers.counseling import intake_case_handler

    return await intake_case_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        data=data,
        uow=ctx.uow,
    )


@router.post(
    "/cases/{case_id}/apply-edits",
    response_model=ApplyCaseEditsResponse,
    status_code=200,
    description=(
        "케이스의 최종 상태(내담자/담당자/장소/시간/회기 날짜)를 한 번에 전달받아, "
        "서버가 현재 상태와 diff를 계산해 필요한 변경만 단일 트랜잭션으로 반영합니다."
    ),
)
async def apply_case_edits(
    case_id: str,
    data: ApplyCaseEditsRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers.counseling import apply_case_edits_handler

    return await apply_case_edits_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        owner_scope=ctx.owner_scope,
        case_id=case_id,
        data=data,
        uow=ctx.uow,
    )


@router.post(
    "/cases/{case_id}/validate-update",
    response_model=ValidateUpdateResponse,
)
async def validate_case_update(
    case_id: str,
    data: ValidateUpdateRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_COUNSELING),
        )
    ),
):
    from app.application.handlers.counseling import validate_case_update_handler

    return await validate_case_update_handler(
        case_id=case_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        owner_scope=ctx.owner_scope,
    )


@router.patch(
    "/cases/{case_id}",
    response_model=CounselingCaseResponse,
)
async def update_case(
    case_id: str,
    data: CounselingCaseUpdateWithReschedule,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers.counseling import update_case_handler

    return await update_case_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/cases/{case_id}",
    status_code=204,
)
async def delete_case(
    case_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_COUNSELING),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers.counseling import delete_case_handler

    await delete_case_handler(
        event_group_id=ctx.event_group_id,
        case_id=case_id,
        center_id=ctx.center_id,
        counselor_id=ctx.owner_scope,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
