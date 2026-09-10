from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.assessment_case.schemas import AssessmentCaseResponse

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
)
from app.modules.schedule.facade import ScheduleFacade


async def cancel_assessment_case_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentCaseResponse:
    case_facade = AssessmentCaseFacade(uow)
    task_facade = AssessmentTaskFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # 수정은 주담당 전용 — 참여 검사자는 열람만
    await case_facade.verify_case_writable(center_id, case_id, owner_scope)

    case_atomic, case = await case_facade.cancel_case(center_id, case_id)

    task_atomics = []
    assessment_ids = await case_facade.get_tasks_by_case_id(case_id)
    if assessment_ids:
        task_atomics, _ = await task_facade.cancel_tasks(
            case_id=case_id,
            assessment_ids=assessment_ids,
            reason="Case 취소로 인한 자동 취소",
        )

    session_atomics = []
    schedule_deleted_atomics = []
    sessions = await case_facade.get_sessions_by_case_id(case_id)
    if sessions:
        session_ids = [session.id for session in sessions]
        session_atomics, _cancelled_count = await session_facade.cancel_sessions(
            session_ids
        )

        schedule_ids = [session.schedule_id for session in sessions]
        if schedule_ids:
            schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
                schedule_ids
            )

    await emit(
        uow,
        "assessment_case_cancelled",
        event_group_id=event_group_id,
        atomics=[
            case_atomic,
            *task_atomics,
            *session_atomics,
            *schedule_deleted_atomics,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    response = AssessmentCaseResponse.model_validate(case)

    # dispatch (tx 밖 — BackgroundTask)
    return response


TOOL = {
    "name": "cancel_assessment_case_handler",
    "permission": "write:assessment_case",
    "purpose": "진행 중인 검사 케이스를 취소 상태로 바꾸고 딸린 검사 항목·세션·일정을 함께 취소한다.",
    "keywords": [
        "cancel assessment case",
        "검사 취소",
        "케이스 취소",
        "검사 중단",
        "예약 취소",
        "검사 안 함",
        "검사 접수 취소",
        "일정까지 취소",
    ],
    "boundaries": "검사 케이스를 '취소' 상태로 보존하는 도구다(기록은 남는다). 기록까지 완전히 지우려면 delete_assessment_case_handler를 쓰고, 잘못 취소한 케이스를 되돌리려면 revert_cancel_case_handler를 쓴다. 검사 일부 항목만 뺄 때는 delete_assessment_task_handler다.",
    "output": "취소된 검사 케이스 (AssessmentCaseResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "취소할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
