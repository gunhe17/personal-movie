from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentSetFacade
from ..schemas import AssessmentSetResponse


async def get_set_handler(
    center_id: str,
    set_id: str,
    uow: UnitOfWork,
) -> AssessmentSetResponse:
    facade = AssessmentSetFacade(uow)
    result = await facade.get_set_with_response(center_id, set_id)

    return result


TOOL = {
    "name": "get_set_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 세트 한 건을 조회한다.",
    "keywords": ["세트 조회", "검사 세트 상세", "set 조회"],
    "boundaries": "단건 세트 조회(읽기). 목록은 list_sets_handler.",
    "output": "검사 세트 상세 (AssessmentSetResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "set_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 세트",
                "description": "조회할 검사 세트의 UUID.",
            },
        },
        "required": ["set_id"],
    },
}
