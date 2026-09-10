from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentPackageFacade
from ..schemas import AssessmentPackageResponse


async def get_package_handler(
    center_id: str,
    package_id: str,
    uow: UnitOfWork,
) -> AssessmentPackageResponse:
    facade = AssessmentPackageFacade(uow)
    result = await facade.get_package_with_response(center_id, package_id)

    return result


TOOL = {
    "name": "get_package_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 패키지 한 건을 조회한다.",
    "keywords": ["패키지 조회", "검사 묶음 상세", "package 조회"],
    "boundaries": "단건 패키지 조회(읽기). 목록은 list_packages_handler.",
    "output": "검사 패키지 상세 (AssessmentPackageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "package_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 패키지",
                "description": "조회할 검사 패키지의 UUID.",
            },
        },
        "required": ["package_id"],
    },
}
