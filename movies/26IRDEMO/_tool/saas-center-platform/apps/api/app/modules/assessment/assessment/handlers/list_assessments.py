from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentRepository
from ..services import ListAssessmentsService
from ..schemas import AssessmentSummary, AssessmentListResponse


async def list_assessments_handler(
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> AssessmentListResponse:
    repo = uow.repo(AssessmentRepository)
    service = ListAssessmentsService(repo)

    items, total = await service.execute(status, page, size)

    pages = (total + size - 1) // size if total > 0 else 1

    return AssessmentListResponse(
        items=[AssessmentSummary.model_validate(item) for item in items],
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_assessments_handler",
    "permission": None,
    "purpose": "심리검사 정의 목록을 상태로 거르고 조회한다.",
    "keywords": ["검사 목록", "검사 카탈로그", "assessment 리스트"],
    "boundaries": "검사 정의 목록(읽기). 단건은 get_assessment_handler.",
    "output": "심리검사 정의 목록 (AssessmentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
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
        "required": ["page", "size"],
    },
}
