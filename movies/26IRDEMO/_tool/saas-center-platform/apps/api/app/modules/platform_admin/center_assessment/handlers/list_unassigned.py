from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.assessment.schemas import AdminAssessmentSummary
from app.modules.platform_admin.center_assessment.repository import (
    AdminCenterAssessmentRepository,
)
from app.modules.platform_admin.center_assessment.services.list_unassigned import (
    ListUnassignedService,
)


async def list_unassigned_handler(
    center_id: str,
    uow: UnitOfWork,
    search: str | None,
) -> list[AdminAssessmentSummary]:
    repo = uow.repo(AdminCenterAssessmentRepository)
    service = ListUnassignedService(repo)
    rows = await service.execute(center_id, search=search)
    return [AdminAssessmentSummary.model_validate(a) for a in rows]


TOOL = {
    "name": "list_unassigned_handler",
    "permission": None,
    "purpose": "센터에 아직 할당되지 않은 검사 목록을 조회한다.",
    "keywords": ["미할당 검사", "할당 안된 검사", "unassigned 검사"],
    "boundaries": "운영자 전용 — 센터에 '미할당' 검사 목록(읽기). 할당된 것은 list_admin_center_assessments_handler.",
    "output": "미할당 검사 목록 (AdminAssessmentSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "기준 센터",
                "description": "미할당 여부를 판단할 기준 센터의 UUID.",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "검사명 검색어(선택).",
            },
        },
        "required": ["center_id"],
    },
}
