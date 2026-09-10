from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.counseling_session_facade import CounselingSessionFacade
from ...counseling_session_participant.schemas import (
    SessionParticipantBatchCreate,
    SessionParticipantResponse,
)


async def add_participants_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    data: SessionParticipantBatchCreate,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> list[SessionParticipantResponse]:
    facade = CounselingSessionFacade(uow)
    atomics, participants = await facade.add_session_participants(
        session_id=session_id,
        center_id=center_id,
        counselor_id=owner_scope,
        client_ids=data.client_ids,
        counselor_ids=data.counselor_ids,
    )
    await emit(
        uow,
        "counseling_session_participant_added",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    return [SessionParticipantResponse.model_validate(p) for p in participants]


TOOL = {
    "name": 'add_participants_handler',
    "permission": "write:counseling",
    "purpose": '상담 회기에 참여자(내담자)를 일괄 추가한다.',
    "keywords": ['add participants', '회기 참여자 추가', '상담 참석자 추가', 'session 참여자'],
    "boundaries": "회기에 참여자 '추가'. 제거는 remove_counseling_participant_handler, 출결은 update_attendance_handler.",
    "output": '추가된 회기 참여자 목록 (SessionParticipantResponse 배열).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '참여자를 추가할 상담 회기의 UUID.'},
            'client_ids': {'description': '추가할 내담자 UUID 목록.', 'items': {'type': 'string'}, 'title': '내담자 목록', 'type': 'array'},
            'counselor_ids': {'description': '추가할 상담사 UUID 목록.', 'items': {'type': 'string'}, 'title': '상담사 목록', 'type': 'array'},
        },
        "required": ['session_id'],
    },
}
