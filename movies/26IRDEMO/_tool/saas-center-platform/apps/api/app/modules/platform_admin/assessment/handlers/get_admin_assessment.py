from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.assessment.assessment.models import Assessment
from app.modules.platform_admin.assessment.schemas import AdminAssessmentDetailResponse


async def get_admin_assessment_handler(
    assessment_id: str,
    uow: UnitOfWork,
) -> AdminAssessmentDetailResponse:
    session = uow.session

    assessment = await session.get(Assessment, assessment_id)
    if not assessment:
        raise EntityNotFoundException(f"검사를 찾을 수 없습니다: {assessment_id}")

    return AdminAssessmentDetailResponse.model_validate(assessment)


TOOL = {
    "name": "get_admin_assessment_handler",
    "permission": None,
    "purpose": "검사(정의) 상세를 운영자가 조회한다.",
    "keywords": ["어드민 검사 상세", "검사 정의 조회", "admin assessment 상세"],
    "boundaries": "운영자 전용 — 검사 정의 상세(읽기). 목록은 list_admin_assessments_handler.",
    "output": "검사 정의 상세 (AdminAssessmentDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "assessment_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사",
                "description": "조회할 검사 정의의 UUID.",
            },
        },
        "required": ["assessment_id"],
    },
}
