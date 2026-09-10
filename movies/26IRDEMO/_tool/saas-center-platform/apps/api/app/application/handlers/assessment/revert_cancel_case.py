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


async def revert_cancel_case_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentCaseResponse:
    # cancelled(미삭제) Case만 롤백 가능. cancelled 상태의 Task/Session만 복원(completed 등은 유지)
    case_facade = AssessmentCaseFacade(uow)
    task_facade = AssessmentTaskFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # 수정은 주담당 전용 — 참여 검사자는 열람만
    await case_facade.verify_case_writable(center_id, case_id, owner_scope)

    case_atomic, case = await case_facade.revert_cancel_case(center_id, case_id)

    task_atomics, _reverted_count = await task_facade.revert_cancel_tasks_by_case(
        case_id
    )

    schedule_restored_atomics = []
    (
        session_atomics,
        restored_sessions,
    ) = await session_facade.revert_cancel_sessions_by_case(case_id)

    if restored_sessions:
        session_ids = [s.id for s in restored_sessions]
        schedule_ids = [s.schedule_id for s in restored_sessions if s.schedule_id]

        await session_facade.revert_cancel_session_participants(session_ids)

        if schedule_ids:
            schedule_restored_atomics, _ = await schedule_facade.restore_schedules(
                schedule_ids
            )

    await emit(
        uow,
        "assessment_case_cancel_reverted",
        event_group_id=event_group_id,
        atomics=[
            case_atomic,
            *task_atomics,
            *session_atomics,
            *schedule_restored_atomics,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentCaseResponse.model_validate(case)


TOOL = {
    "name": "revert_cancel_case_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 케이스의 진행 상태를 이전 단계로 되돌린다.",
    "keywords": [
        "rollback assessment case",
        "케이스 롤백",
        "상태 되돌리기",
        "검사 단계 복구",
        "진행 취소",
        "rollback",
    ],
    "boundaries": "케이스 '상태'를 이전 단계로 되돌린다(삭제 아님). 완전 삭제는 delete_assessment_case_handler.",
    "output": "이전 단계로 되돌려진 검사 케이스 (AssessmentCaseResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "상태를 되돌릴 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
