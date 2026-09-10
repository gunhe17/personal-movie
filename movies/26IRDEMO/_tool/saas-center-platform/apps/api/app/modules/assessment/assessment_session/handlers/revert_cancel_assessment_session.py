from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..schemas import AssessmentSessionResponse


async def revert_cancel_assessment_session_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    session_id: str,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentSessionResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentSessionFacade(uow).verify_session_writable(
        center_id, session_id, owner_scope
    )

    atomic, session = await AssessmentSessionFacade(uow).revert_cancel_session(
        center_id=center_id,
        session_id=session_id,
    )

    # emit — 되돌리기 알림은 반응(notify_assessment_session_reverted)이 워커에서 처리
    await emit(
        uow,
        "assessment_session_reverted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": "revert_cancel_assessment_session_handler",
    "fn": "revert_cancel_assessment_session_handler",
    "permission": "write:schedule",
    "purpose": "취소했던 검사 회기를 되돌린다.",
    "keywords": ['revert cancel assessment session', "취소 되돌리기", "회기 복구", "revert cancel"],
    "boundaries": "cancel_assessment_session_handler의 취소를 '되돌린다'.",
    "output": "취소가 되돌려진 검사 회기 (AssessmentSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '취소를 되돌릴 검사 회기의 UUID.'},
        },
        "required": ["session_id"],
    },
}
