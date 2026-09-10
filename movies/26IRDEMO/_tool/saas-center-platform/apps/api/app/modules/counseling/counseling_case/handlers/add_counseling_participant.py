from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...counseling_case_participant.schemas import (
    CounselingCaseParticipantCreate,
    CounselingCaseParticipantResponse,
)
from ...facade import CounselingCaseFacade


async def add_counseling_participant_handler(
    *,
    event_group_id: uuid_str,
    case_id: str,
    center_id: str,
    owner_scope: str | None,
    data: CounselingCaseParticipantCreate,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> CounselingCaseParticipantResponse:
    facade = CounselingCaseFacade(uow)
    atomics, participant = await facade.add_participant(
        case_id=case_id,
        center_id=center_id,
        counselor_id=owner_scope,
        participant_id=data.participant_id,
        participant_type=data.participant_type.value,
    )
    await emit(
        uow,
        "counseling_case_participant_added",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    return CounselingCaseParticipantResponse.model_validate(participant)


TOOL = {
    "name": "add_counseling_participant_handler",
    "fn": "add_counseling_participant_handler",
    "permission": "write:counseling",
    "purpose": "상담 케이스에 참여자를 추가한다.",
    "keywords": [
        "add counseling participant",
        "케이스 참여자 추가",
        "상담 대상 추가",
        "participant 추가",
    ],
    "boundaries": "상담 케이스에 참여자 추가. 떠나기는 leave_participant_handler, 목록은 list_counseling_participants_handler.",
    "output": "추가된 케이스 참여자 (CounselingCaseParticipantResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "참여자를 추가할 상담 케이스의 UUID.",
            },
            "participant_id": {
                "type": "string",
                "format": "uuid",
                "title": "참여자",
                "description": "추가할 참여자의 UUID (내담자 Client.id 또는 상담사 Member.id).",
            },
            "participant_type": {
                "$ref": "#/$defs/CaseParticipantType",
                "description": "역할: client(내담자) 또는 counselor(상담사).",
            },
        },
        "$defs": {
            "CaseParticipantType": {
                "enum": ["client", "counselor"],
                "title": "CaseParticipantType",
                "type": "string",
            }
        },
        "required": ["case_id", "participant_id", "participant_type"],
    },
}
