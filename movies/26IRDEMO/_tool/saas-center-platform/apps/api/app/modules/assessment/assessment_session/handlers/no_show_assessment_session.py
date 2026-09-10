from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..repository import AssessmentSessionRepository
from ..services import NoShowSessionService
from ..schemas import AssessmentSessionResponse


async def no_show_assessment_session_handler(
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

    service = NoShowSessionService(uow.repo(AssessmentSessionRepository))
    atomic, session = await service.execute(center_id, session_id)

    # emit — 노쇼 알림은 반응(notify_assessment_session_no_show)이 워커에서 처리
    await emit(
        uow,
        "assessment_session_no_show",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": "no_show_assessment_session_handler",
    "fn": "no_show_assessment_session_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 회기를 노쇼(불참)로 처리한다.",
    "keywords": ['noshow assessment session', "노쇼 처리", "불참", "no show", "결석 처리"],
    "boundaries": "회기를 '노쇼'로 표시. 출석은 attend_assessment_session_handler, 취소는 cancel_assessment_session_handler.",
    "output": "노쇼 처리된 검사 회기 (AssessmentSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '노쇼 처리할 검사 회기의 UUID.'},
        },
        "required": ["session_id"],
    },
}
