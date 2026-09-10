from dataclasses import asdict

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentFacade
from ..repository import CenterAssessmentRepository
from ..services import ListCenterAssessmentsService, BuildCenterAssessmentsService
from ..schemas import CenterAssessmentWithAssessment


async def list_center_assessments_handler(
    center_id: str,
    uow: UnitOfWork,
    search: str | None,
    assessment_type: str | None,
    is_active: bool | None,
) -> list[CenterAssessmentWithAssessment]:
    # load
    repo = uow.repo(CenterAssessmentRepository)
    service = ListCenterAssessmentsService(repo)
    center_assessments = await service.execute(center_id, is_active=is_active)

    assessment_ids = [ca.assessment_id for ca in center_assessments]

    assessment_facade = AssessmentFacade(uow)
    assessments = await assessment_facade.get_assessments_by_ids(assessment_ids)

    # compute
    build_service = BuildCenterAssessmentsService()
    combined = build_service.execute(
        center_assessments,
        assessments,
        search=search,
        assessment_type=assessment_type,
    )

    return [CenterAssessmentWithAssessment(**asdict(item)) for item in combined]


TOOL = {
    "name": "list_center_assessments_handler",
    "permission": "read:center_assessment",
    "purpose": "센터에 할당된 검사 목록을 조회한다.",
    "keywords": ["센터 검사 목록", "할당 검사 조회", "center assessment 목록"],
    "boundaries": "센터 할당 검사 목록(읽기). 할당은 create_center_assessment_handler.",
    "output": "센터 할당 검사 목록 (CenterAssessmentWithAssessment 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "검색어(선택).",
            },
            "assessment_type": {
                "type": "string",
                "title": "유형 필터",
                "description": "검사 유형 필터(선택).",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 여부 필터(선택).",
            },
        },
        "required": [],
    },
}
