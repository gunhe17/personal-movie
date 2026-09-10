from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentCaseFacade
from ..repository import AssessmentCaseParticipantRepository
from ..services import AddCaseParticipantService
from ..schemas import ParticipantAdd, ParticipantResponse


async def add_assessment_participant_handler(
    center_id: str,
    case_id: str,
    data: ParticipantAdd,
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
    service = AddCaseParticipantService(repo)

    atomic, participant = await service.execute(
        center_id=center_id,
        case_id=case_id,
        participant_type=data.participant_type.value,
        participant_id=data.participant_id,
    )
    await emit(
        uow,
        "assessment_case_participant_added",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ParticipantResponse.model_validate(participant)


TOOL = {
    "name": 'add_assessment_participant_handler',
    "fn": "add_assessment_participant_handler",
    "permission": "write:assessment_case",
    "purpose": '검사 케이스에 참여자를 추가한다.',
    "keywords": ['add assessment participant', '참여자 추가', '대상자 추가', 'participant 추가', '내담자 참여'],
    "boundaries": "케이스에 '참여자'를 더한다. 제거는 remove_assessment_participant_handler, 목록은 list_assessment_participants_handler.",
    "output": '추가된 검사 참여자 (ParticipantResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'case_id': {'type': 'string', 'format': 'uuid', 'title': '대상 케이스', 'description': '참여자를 추가할 검사 케이스의 UUID.'},
            'participant_type': {'$ref': '#/$defs/ParticipantType', 'description': '참여자 유형: client(내담자) 또는 assistant(보조 검사자).'},
            'participant_id': {'title': '참여자', 'type': 'string', 'format': 'uuid', 'description': '추가할 참여자의 UUID.'},
        },
        "$defs": {'ParticipantType': {'enum': ['client', 'assistant'], 'title': 'ParticipantType', 'type': 'string'}},
        "required": ['case_id', 'participant_type', 'participant_id'],
    },
}
