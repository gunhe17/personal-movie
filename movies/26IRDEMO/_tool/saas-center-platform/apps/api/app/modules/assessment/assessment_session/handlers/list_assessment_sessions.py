from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentSessionRepository
from ..services import ListSessionsService
from ...assessment_case.repository import AssessmentCaseRepository
from ...assessment_case.services import GetAssessmentCaseService
from ..schemas import AssessmentSessionResponse


async def list_assessment_sessions_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
) -> list[AssessmentSessionResponse]:
    # IDOR 방지: case 가 이 center 소유인지 먼저 검증(타 센터 case_id → 404).
    await GetAssessmentCaseService(uow.repo(AssessmentCaseRepository)).execute(
        center_id, case_id
    )

    repo = uow.repo(AssessmentSessionRepository)
    service = ListSessionsService(repo)

    sessions = await service.execute(case_id)

    return [AssessmentSessionResponse.model_validate(s) for s in sessions]


TOOL = {
    "name": "list_assessment_sessions_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스의 회기 목록을 조회한다.",
    "keywords": ["회기 목록", "검사 회기 리스트", "session 목록"],
    "boundaries": "케이스 회기 목록(읽기). 단건은 get_assessment_session_handler.",
    "output": "검사 케이스 회기 목록 (AssessmentSessionResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "회기를 조회할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
