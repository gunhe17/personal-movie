from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..repository import AssessmentSessionRepository
from ..services import AttendSessionService
from ..schemas import AssessmentSessionResponse


async def attend_assessment_session_handler(
    center_id: str,
    session_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentSessionResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentSessionFacade(uow).verify_session_writable(
        center_id, session_id, owner_scope
    )

    repo = uow.repo(AssessmentSessionRepository)
    service = AttendSessionService(repo)
    atomic, session = await service.execute(center_id, session_id)
    await emit(
        uow,
        "assessment_session_attended",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": "attend_assessment_session_handler",
    "fn": "attend_assessment_session_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 회기에 출석 처리한다.",
    "keywords": ['attend assessment session', "출석 처리", "회기 참석", "attend", "검사 출석"],
    "boundaries": "검사 '회기' 출석 처리. 노쇼는 no_show_assessment_session_handler, 취소는 cancel_assessment_session_handler.",
    "output": "출석 처리된 검사 회기 (AssessmentSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '출석 처리할 검사 회기의 UUID.'},
        },
        "required": ["session_id"],
    },
}
