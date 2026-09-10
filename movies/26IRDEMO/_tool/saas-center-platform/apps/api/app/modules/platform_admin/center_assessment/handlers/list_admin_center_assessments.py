from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.center_assessment.schemas import (
    CenterAssessmentWithAssessment,
)
from app.modules.platform_admin.center_assessment.repository import (
    AdminCenterAssessmentRepository,
)
from app.modules.platform_admin.center_assessment.services.list_center_assessments import (
    ListCenterAssessmentsService,
)


async def list_admin_center_assessments_handler(
    center_id: str,
    uow: UnitOfWork,
    search: str | None,
    is_active: bool | None,
) -> list[CenterAssessmentWithAssessment]:
    repo = uow.repo(AdminCenterAssessmentRepository)
    service = ListCenterAssessmentsService(repo)
    return await service.execute(center_id, search=search, is_active=is_active)


TOOL = {
    "name": "list_admin_center_assessments_handler",
    "permission": None,
    "purpose": "센터에 할당된 검사 목록을 운영자가 조회한다.",
    "keywords": ["센터 할당 검사", "center assessment 목록", "할당 검사 조회"],
    "boundaries": "운영자 전용 — 센터 할당 검사 목록(읽기). 미할당은 list_unassigned_handler.",
    "output": "센터 할당 검사 목록 (CenterAssessmentWithAssessment 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "조회할 센터의 UUID.",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "검사명 검색어(선택).",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 검사만/비활성만 필터(선택).",
            },
        },
        "required": ["center_id"],
    },
}
