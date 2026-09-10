from sqlalchemy import select, func, or_

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment.models import Assessment
from app.modules.platform_admin.assessment.schemas import (
    AdminAssessmentSummary,
    AdminAssessmentListResponse,
)


async def list_admin_assessments_handler(
    uow: UnitOfWork,
    *,
    search: str | None = None,
    status: str | None = None,
    assessment_type: str | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminAssessmentListResponse:
    session = uow.session

    # 관리자: 삭제된 것도 포함 (deleted_at 조건 없음)
    conditions = []

    if status:
        conditions.append(Assessment.status == status)

    if assessment_type:
        conditions.append(Assessment.assessment_type == assessment_type)

    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Assessment.kor_name.ilike(search_pattern),
                Assessment.eng_name.ilike(search_pattern),
                Assessment.code.ilike(search_pattern),
            )
        )

    # 총 개수
    count_stmt = select(func.count()).select_from(Assessment)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = (await session.execute(count_stmt)).scalar_one()

    # 메인 쿼리 (삭제되지 않은 것 먼저, 그 안에서 created_at desc)
    offset = (page - 1) * size
    stmt = (
        select(Assessment)
        .order_by(
            Assessment.deleted_at.is_not(None).asc(),
            Assessment.created_at.desc(),
        )
        .offset(offset)
        .limit(size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    result = await session.execute(stmt)
    assessments = list(result.scalars().all())

    items = [AdminAssessmentSummary.model_validate(a) for a in assessments]

    return AdminAssessmentListResponse.build(
        items=items,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_admin_assessments_handler",
    "permission": None,
    "purpose": "검사(정의) 목록을 운영자가 검색·상태·유형으로 거르고 조회한다.",
    "keywords": ["어드민 검사 목록", "검사 정의 조회", "admin assessments"],
    "boundaries": "운영자 전용 — 검사 정의 목록(읽기). 단건은 get_admin_assessment_handler.",
    "output": "검사 정의 목록 (AdminAssessmentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "검사명 검색어(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
            "type": {
                "type": "string",
                "title": "유형 필터",
                "description": "검사 유형 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
