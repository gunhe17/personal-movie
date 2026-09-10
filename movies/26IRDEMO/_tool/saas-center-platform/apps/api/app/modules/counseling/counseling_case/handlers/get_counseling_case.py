from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingCaseResponse
from ...facade import CounselingCaseFacade


async def get_counseling_case_handler(
    case_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> CounselingCaseResponse:
    facade = CounselingCaseFacade(uow)

    response = await facade.get_case_with_response(
        case_id=case_id,
        center_id=center_id,
        counselor_id=owner_scope,
    )

    return response


TOOL = {
    "name": "get_counseling_case_handler",
    "permission": None,
    "purpose": "상담 케이스 한 건을 조회한다.",
    "keywords": ["상담 케이스 조회", "상담 사례 상세", "counseling case 조회"],
    "boundaries": "단건 상담 케이스 조회(읽기). 목록은 list_counseling_cases_handler.",
    "output": "상담 케이스 상세 (CounselingCaseResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "조회할 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
