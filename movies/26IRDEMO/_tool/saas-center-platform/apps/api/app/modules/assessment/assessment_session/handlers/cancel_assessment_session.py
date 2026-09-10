from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..schemas import AssessmentSessionResponse


async def cancel_assessment_session_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    session_id: str,
    uow: UnitOfWork,
    actor_id: str,
    cancel_reason: str | None = None,
    owner_scope: str | None = None,
) -> AssessmentSessionResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentSessionFacade(uow).verify_session_writable(
        center_id, session_id, owner_scope
    )

    facade = AssessmentSessionFacade(uow)
    atomic, session = await facade.cancel_session(
        center_id=center_id,
        session_id=session_id,
        cancel_reason=cancel_reason,
    )

    # emit — 취소 알림은 반응(notify_assessment_session_cancelled)이 워커에서 처리
    await emit(
        uow,
        "assessment_session_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": "cancel_assessment_session_handler",
    "fn": "cancel_assessment_session_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 회기를 취소한다.",
    "keywords": ['cancel assessment session', "회기 취소", "검사 취소", "session 취소"],
    "boundaries": "검사 회기 취소. 되돌리기는 revert_cancel_assessment_session_handler, 노쇼는 no_show_assessment_session_handler.",
    "output": "취소된 검사 회기 (AssessmentSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '취소할 검사 회기의 UUID.'},
            "cancel_reason": {'type': 'string', 'title': '취소 사유', 'description': '취소 사유(선택).'},
        },
        "required": ["session_id"],
    },
}
