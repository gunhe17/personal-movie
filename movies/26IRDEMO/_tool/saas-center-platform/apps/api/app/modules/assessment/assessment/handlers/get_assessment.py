from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentRepository
from ..services import GetAssessmentService
from ..schemas import AssessmentResponse


async def get_assessment_handler(
    assessment_id: str,
    uow: UnitOfWork,
) -> AssessmentResponse:
    repo = uow.repo(AssessmentRepository)
    service = GetAssessmentService(repo)

    assessment = await service.execute(assessment_id)

    return AssessmentResponse.model_validate(assessment)


TOOL = {
    "name": "get_assessment_handler",
    "permission": None,
    "purpose": "심리검사 정의 한 건을 조회한다.",
    "keywords": ["검사 조회", "검사 정의 상세", "assessment 조회"],
    "boundaries": "단건 검사 정의 조회(읽기). 목록은 list_assessments_handler.",
    "output": "심리검사 정의 상세 (AssessmentResponse).",
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
