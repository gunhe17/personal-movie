from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentSessionRepository
from ..services import GetSessionService
from ..schemas import AssessmentSessionResponse


async def get_assessment_session_handler(
    center_id: str,
    session_id: str,
    uow: UnitOfWork,
) -> AssessmentSessionResponse:
    repo = uow.repo(AssessmentSessionRepository)
    service = GetSessionService(repo)

    session = await service.execute(center_id, session_id)

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": "get_assessment_session_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 회기 한 건을 조회한다.",
    "keywords": ["회기 조회", "검사 회기 상세", "session 조회"],
    "boundaries": "단건 회기 조회(읽기). 목록은 list_assessment_sessions_handler.",
    "output": "검사 회기 상세 (AssessmentSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "조회할 검사 회기의 UUID.",
            },
        },
        "required": ["session_id"],
    },
}
