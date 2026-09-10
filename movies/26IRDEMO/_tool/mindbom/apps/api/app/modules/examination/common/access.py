"""검사 access 검증 — sub-router 공통 dependency

clinician 역할은 자기가 examiner인 검사에만 접근 가능.
admin은 기관 전체 검사 접근 가능 (멤버십은 get_institution_context 단계에서 검증).

HTP/Rorschach/SCT 같은 sub-router에 router-level dependency로 부착해
해당 prefix 하위의 모든 엔드포인트에 일괄 적용한다.

권한 방어선:
- L1: 본 dependency — sub-router 진입 시 검사 단위 ownership 검증 (admin pass-through)
- L2: ExaminationFacade — 메인 examination CRUD는 service 레이어의
      `require_examiner_id` 옵션으로 동일 정책 적용 (이 dependency 미사용)
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
)
from app.modules.examination.common.repository import ExaminationRepository


async def require_exam_access(
    request: Request,
    ctx: InstitutionContext = Depends(get_institution_context),
    session: AsyncSession = Depends(get_db),
) -> InstitutionContext:
    if ctx.role != "clinician":
        return ctx

    # sub-router별로 exam_id 또는 examination_id 사용
    exam_id = (
        request.path_params.get("exam_id")
        or request.path_params.get("examination_id")
    )
    if not exam_id:
        return ctx  # path에 검사 id가 없는 라우트는 통과

    repo = ExaminationRepository(session)
    exam = await repo.get(exam_id)
    if exam is None or exam.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="검사를 찾을 수 없습니다.",
        )
    if exam.institution_id != ctx.institution_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 기관의 검사가 아닙니다.",
        )
    if exam.examiner_id != ctx.member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 담당하는 검사가 아닙니다.",
        )
    return ctx
