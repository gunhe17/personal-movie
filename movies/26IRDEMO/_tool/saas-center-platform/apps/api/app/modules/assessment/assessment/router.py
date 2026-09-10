from fastapi import APIRouter, Depends, Query

from app.behavior import behavior, UnscopedContext, authenticate
from .handlers import (
    get_assessment_handler,
    list_assessments_handler,
)
from .schemas import AssessmentResponse, AssessmentListResponse

router = APIRouter(prefix="/assessments", tags=["Assessment"])


@router.get("", response_model=AssessmentListResponse)
async def list_assessments(
    status: str | None = Query(
        default=None, description="공개 상태 필터 (public/private)"
    ),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await list_assessments_handler(status, page, size, ctx.uow)


@router.get("/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: str,
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    return await get_assessment_handler(assessment_id, ctx.uow)
