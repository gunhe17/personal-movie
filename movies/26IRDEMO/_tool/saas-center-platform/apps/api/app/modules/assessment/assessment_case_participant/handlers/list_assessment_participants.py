from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentCaseParticipantRepository
from ..services import ListCaseParticipantsService
from ..schemas import ParticipantResponse


async def list_assessment_participants_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
) -> list[ParticipantResponse]:
    repo = uow.repo(AssessmentCaseParticipantRepository)
    service = ListCaseParticipantsService(repo)

    items = await service.execute(case_id)

    return [ParticipantResponse.model_validate(item) for item in items]


TOOL = {
    "name": "list_assessment_participants_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스의 참여자 목록을 조회한다.",
    "keywords": ["참여자 목록", "대상자 조회", "participant 목록"],
    "boundaries": "케이스 참여자 목록(읽기). 추가는 add_assessment_participant_handler.",
    "output": "검사 케이스 참여자 목록 (ParticipantResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "참여자를 조회할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
