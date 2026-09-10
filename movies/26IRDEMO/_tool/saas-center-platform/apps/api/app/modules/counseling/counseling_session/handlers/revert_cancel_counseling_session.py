from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import CounselingSessionFacade
from ..schemas import CounselingSessionResponse


async def revert_cancel_counseling_session_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> CounselingSessionResponse:
    facade = CounselingSessionFacade(uow)
    atomic, session = await facade.revert_cancel_session(
        session_id=session_id,
        center_id=center_id,
        counselor_id=owner_scope,
    )

    # emit — 복구 알림은 반응(notify_counseling_session_reverted)이 워커에서 발송
    await emit(
        uow,
        "counseling_session_reverted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    return CounselingSessionResponse.model_validate(session)


TOOL = {
    "name": 'revert_cancel_counseling_session_handler',
    "fn": "revert_cancel_counseling_session_handler",
    "permission": "write:schedule",
    "purpose": '취소한 상담 회기를 되돌린다.',
    "keywords": ['revert cancel counseling session', '회기 취소 되돌리기', '상담 복구', 'revert cancel'],
    "boundaries": 'cancel_counseling_session_handler의 취소를 되돌린다.',
    "output": '취소가 되돌려진 상담 회기 (CounselingSessionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '취소를 되돌릴 상담 회기의 UUID.'},
        },
        "required": ['session_id'],
    },
}
