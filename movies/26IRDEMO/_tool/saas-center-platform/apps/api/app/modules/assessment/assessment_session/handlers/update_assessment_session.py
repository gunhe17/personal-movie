from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentSessionFacade
from ..repository import AssessmentSessionRepository
from ..services import UpdateSessionService
from ..schemas import AssessmentSessionUpdate, AssessmentSessionResponse


async def update_assessment_session_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    session_id: str,
    data: AssessmentSessionUpdate,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentSessionResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentSessionFacade(uow).verify_session_writable(
        center_id, session_id, owner_scope
    )

    repo = uow.repo(AssessmentSessionRepository)
    service = UpdateSessionService(repo)

    atomic, session = await service.execute(
        center_id=center_id,
        session_id=session_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        status=data.status.value if data.status is not None else None,
    )
    await emit(
        uow,
        "assessment_session_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSessionResponse.model_validate(session)


TOOL = {
    "name": 'update_assessment_session_handler',
    "fn": "update_assessment_session_handler",
    "permission": "write:assessment_case",
    "purpose": '검사 회기 정보를 수정한다.',
    "keywords": ['update assessment session', '회기 수정', '검사 회기 변경', 'session 수정'],
    "boundaries": '회기 수정. 생성은 create_assessment_session_handler.',
    "output": '수정된 검사 회기 (AssessmentSessionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '수정할 검사 회기의 UUID.'},
            'status': {'anyOf': [{'$ref': '#/$defs/SessionStatus'}, {'type': 'null'}], 'default': None},
        },
        "$defs": {'SessionStatus': {'enum': ['scheduled', 'attended', 'no_show', 'cancelled'], 'title': 'SessionStatus', 'type': 'string'}},
        "required": ['session_id'],
    },
}
