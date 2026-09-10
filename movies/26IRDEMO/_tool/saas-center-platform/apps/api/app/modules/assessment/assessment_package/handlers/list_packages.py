from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentPackageFacade
from ..schemas import AssessmentPackageListResponse


async def list_packages_handler(
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
    search: str | None = None,
    assessment_type: str | None = None,
) -> AssessmentPackageListResponse:
    facade = AssessmentPackageFacade(uow)
    result = await facade.list_packages_with_response(
        center_id,
        page,
        size,
        search,
        assessment_type,
    )

    return result


TOOL = {
    "name": "list_packages_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 패키지 목록을 검색·유형으로 거르고 조회한다.",
    "keywords": ["패키지 목록", "검사 묶음 목록", "package 리스트"],
    "boundaries": "패키지 목록(읽기). 단건은 get_package_handler.",
    "output": "검사 패키지 목록 (AssessmentPackageListResponse).",
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
                "title": "검사 유형 필터",
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
        "required": ["page", "size"],
    },
}
