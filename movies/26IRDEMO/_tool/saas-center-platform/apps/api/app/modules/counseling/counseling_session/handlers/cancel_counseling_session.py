from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import CounselingSessionFacade
from ..schemas import CounselingSessionResponse


async def cancel_counseling_session_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
    actor_id: str,
    cancel_reason: str | None = None,
) -> CounselingSessionResponse:
    atomic, session = await CounselingSessionFacade(uow).cancel_session_with_reason(
        session_id=session_id,
        center_id=center_id,
        counselor_id=owner_scope,
        cancel_reason=cancel_reason,
    )

    # emit — 취소 알림은 반응(notify_counseling_session_cancelled)이 워커에서 처리
    await emit(
        uow,
        "counseling_session_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    return CounselingSessionResponse.model_validate(session)


TOOL = {
    "name": 'cancel_counseling_session_handler',
    "fn": "cancel_counseling_session_handler",
    "permission": "write:counseling",
    "purpose": '상담 회기를 취소한다.',
    "keywords": ['cancel counseling session', '회기 취소', '상담 취소', 'session 취소'],
    "boundaries": '상담 회기 취소. 되돌리기는 revert_cancel_counseling_session_handler.',
    "output": '취소된 상담 회기 (CounselingSessionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '취소할 상담 회기의 UUID.'},
            'cancel_reason': {'type': 'string', 'title': '취소 사유', 'description': '취소 사유(선택).'},
        },
        "required": ['session_id'],
    },
}
