from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..repository import AssessmentSessionRepository
from ..services import CreateSessionService
from ..schemas import AssessmentSessionCreate, AssessmentSessionResponse


async def create_assessment_session_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    case_id: str,
    data: AssessmentSessionCreate,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentSessionResponse:
    # 생성도 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentSessionFacade(uow).verify_case_writable(
        center_id, case_id, owner_scope
    )

    repo = uow.repo(AssessmentSessionRepository)
    service = CreateSessionService(repo)

    atomic, session = await service.execute(center_id, case_id, data.schedule_id)
    await emit(
        uow,
        "assessment_session_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": 'create_assessment_session_handler',
    "fn": "create_assessment_session_handler",
    "permission": "write:assessment_case",
    "purpose": '검사 케이스에 검사 회기를 생성한다.',
    "keywords": ['create assessment session', '회기 생성', '검사 일정 생성', 'session 생성'],
    "boundaries": '검사 회기를 만든다. 수정은 update_assessment_session_handler.',
    "output": '생성된 검사 회기 (AssessmentSessionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'case_id': {'type': 'string', 'format': 'uuid', 'title': '대상 케이스', 'description': '회기를 생성할 검사 케이스의 UUID.'},
            'schedule_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '연결 일정', 'description': '연결할 일정(schedule)의 UUID(선택).'},
        },
        "required": ['case_id'],
    },
}
