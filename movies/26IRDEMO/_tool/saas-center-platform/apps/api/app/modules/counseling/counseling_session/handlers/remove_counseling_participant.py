from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import CounselingSessionFacade
from ...counseling_session_participant.repository import CounselingSessionParticipantRepository
from ...counseling_session_participant.services import RemoveSessionParticipantService


async def remove_counseling_participant_handler(
    *,
    event_group_id: uuid_str,
    session_participant_id: str,
    center_id: str,
    uow: UnitOfWork,
    actor_id: str | None = None,
    owner_scope: str | None = None,
) -> None:
    # 참여자 제외는 케이스 주담당 전용 — 공동 상담사는 열람만
    await CounselingSessionFacade(uow).verify_session_participant_writable(
        session_participant_id, center_id, owner_scope
    )

    service = RemoveSessionParticipantService(uow.repo(CounselingSessionParticipantRepository))
    atomic, _ = await service.execute(
        session_participant_id=session_participant_id,
        center_id=center_id,
    )
    await emit(
        uow,
        "counseling_session_participant_removed",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": 'remove_counseling_participant_handler',
    "fn": "remove_counseling_participant_handler",
    "permission": "write:counseling",
    "purpose": '상담 회기에서 참여자를 제거한다.',
    "keywords": ['remove counseling participant', '회기 참여자 제거', '참석자 삭제', 'participant 제거'],
    "boundaries": '회기 참여자 제거. 추가는 add_participants_handler.',
    "output": '없음 (회기 참여자 제거).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_participant_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기 참여자', 'description': '제거할 회기 참여자의 UUID.'},
        },
        "required": ['session_participant_id'],
    },
}
