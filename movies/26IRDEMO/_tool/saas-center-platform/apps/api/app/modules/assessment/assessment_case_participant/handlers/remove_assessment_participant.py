from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentCaseFacade
from ..repository import AssessmentCaseParticipantRepository
from ..services import RemoveCaseParticipantService
from ..schemas import ParticipantResponse


async def remove_assessment_participant_handler(
    center_id: str,
    case_id: str,
    participant_type: str,
    participant_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> ParticipantResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentCaseFacade(uow).verify_case_writable(
        center_id, case_id, owner_scope
    )

    repo = uow.repo(AssessmentCaseParticipantRepository)
    service = RemoveCaseParticipantService(repo)

    atomic, participant = await service.execute(
        case_id=case_id,
        participant_type=participant_type,
        participant_id=participant_id,
    )
    await emit(
        uow,
        "assessment_case_participant_removed",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ParticipantResponse.model_validate(participant)


TOOL = {
    "name": "remove_assessment_participant_handler",
    "fn": "remove_assessment_participant_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 케이스에서 참여자를 제거한다.",
    "keywords": ['remove assessment participant', "참여자 제거", "대상자 삭제", "participant 제거"],
    "boundaries": "케이스에서 '참여자'를 뺀다. 추가는 add_assessment_participant_handler.",
    "output": "제거 후 참여자 정보 (ParticipantResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {'type': 'string', 'format': 'uuid', 'title': '대상 케이스', 'description': '검사 케이스의 UUID.'},
            "participant_type": {'type': 'string', 'title': '참여자 유형', 'description': '참여자 유형(client/assistant).'},
            "participant_id": {'type': 'string', 'format': 'uuid', 'title': '대상 참여자', 'description': '제거할 참여자의 UUID.'},
        },
        "required": ["case_id", "participant_type", "participant_id"],
    },
}
