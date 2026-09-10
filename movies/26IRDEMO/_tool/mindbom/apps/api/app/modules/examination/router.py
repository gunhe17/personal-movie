"""Examination Router — 검사 관리 API"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import ClientInfo, get_client_info
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
)
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.examination.common.schemas import (
    DashboardStats,
    ExaminationBatteryCreate,
    ExaminationBatteryResponse,
    ExaminationCreate,
    ExaminationListWithNamesResponse,
    ExaminationResponse,
    ExaminationUpdate,
)
from app.modules.examination.handlers import (
    handle_create_battery,
    handle_create_examination,
    handle_dashboard_stats,
    handle_get_examination,
    handle_list_examinations,
    handle_update_examination,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/examinations",
    tags=["examinations"],
)


@router.get("", response_model=ExaminationListWithNamesResponse)
async def list_examinations(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    page: int = Query(1, ge=1),
    # 상한 500 — 타임라인은 기간 창 전체를 한 번에 받아 그린다(페이징 없음).
    size: int = Query(20, ge=1, le=500),
    status: str | None = Query(None),
    exam_type: str | None = Query(None, pattern="^(htp|rorschach|sct)$"),
    client_id: str | None = Query(None),
    examiner_id: str | None = Query(None),
    mine: bool = Query(False, description="본인 검사만 (admin 옵션, clinician은 항상 본인 검사만)"),
    search: str | None = Query(None),
    date_from: datetime | None = Query(
        None, description="기간 시작(포함). 기준시각 = 예정일, 없으면 생성일"
    ),
    date_to: datetime | None = Query(None, description="기간 끝(미포함)"),
):
    return await handle_list_examinations(
        ctx, uow,
        page=page, size=size, status=status,
        exam_type=exam_type, client_id=client_id,
        examiner_id=examiner_id, mine=mine,
        search=search, date_from=date_from, date_to=date_to,
    )


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_dashboard_stats(ctx, uow)


@router.get("/{exam_id}", response_model=ExaminationResponse)
async def get_examination(
    exam_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_examination(ctx, exam_id, uow)


@router.post("", response_model=ExaminationResponse, status_code=201)
async def create_examination(
    data: ExaminationCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_create_examination(ctx, data, client_info, uow)


@router.post("/battery", response_model=ExaminationBatteryResponse, status_code=201)
async def create_battery(
    data: ExaminationBatteryCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    """검사 배터리 등록 — 여러 검사 유형을 한 번에 생성"""
    return await handle_create_battery(ctx, data, client_info, uow)


@router.patch("/{exam_id}", response_model=ExaminationResponse)
async def update_examination(
    exam_id: str,
    data: ExaminationUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_examination(ctx, exam_id, data, client_info, uow)
