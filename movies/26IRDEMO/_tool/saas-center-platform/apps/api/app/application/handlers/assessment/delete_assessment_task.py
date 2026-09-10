from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
)
from app.modules.schedule.facade import ScheduleFacade


async def delete_assessment_task_handler(
    task_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> MessageResponse:
    task_facade = AssessmentTaskFacade(uow)
    case_facade = AssessmentCaseFacade(uow)

    # 삭제도 케이스 주담당 전용 — 참여 검사자는 열람만
    await task_facade.verify_task_writable(center_id, task_id, owner_scope)

    atomics, deleted_task, remaining_count = await task_facade.delete_task(
        task_id, center_id
    )

    case_id = deleted_task.case_id

    if remaining_count > 0:
        remaining_assessment_ids = await case_facade.get_tasks_by_case_id(case_id)
        summary_atomic, _ = await case_facade.update_assessment_summary(
            center_id, case_id, remaining_assessment_ids
        )
        atomics.append(summary_atomic)

    # 남은 Task가 0개이면 Case까지 cascade soft delete
    schedule_deleted_atomics = []
    if remaining_count == 0:
        session_facade = AssessmentSessionFacade(uow)
        schedule_facade = ScheduleFacade(uow)

        sessions = await case_facade.get_sessions_by_case_id(case_id)
        schedule_ids = (
            [s.schedule_id for s in sessions if s.schedule_id] if sessions else []
        )

        case_atomic, _ = await case_facade.delete_case(center_id, case_id)
        atomics.append(case_atomic)
        participant_atomics, _ = await case_facade.delete_participants_by_case(case_id)
        atomics.extend(participant_atomics)
        if sessions:
            session_atomics, _ = await session_facade.delete_sessions_and_participants(
                case_id
            )
            atomics.extend(session_atomics)
        if schedule_ids:
            schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
                schedule_ids
            )

    await emit(
        uow,
        "assessment_task_deleted",
        event_group_id=event_group_id,
        atomics=[*atomics, *schedule_deleted_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    if remaining_count == 0:
        return MessageResponse(
            message="검사가 삭제되었습니다. 남은 검사가 없어 케이스도 함께 삭제되었습니다"
        )

    return MessageResponse(message="검사가 삭제되었습니다")


TOOL = {
    "name": "delete_assessment_task_handler",
    "permission": "delete:assessment_case",
    "purpose": "검사 케이스 안의 개별 검사 작업(task)을 삭제한다.",
    "keywords": [
        "delete assessment task",
        "검사 작업 삭제",
        "task 삭제",
        "개별 검사 제거",
        "검사 항목 삭제",
    ],
    "boundaries": "케이스 내 'task' 단위 삭제. 케이스 전체 삭제는 delete_assessment_case_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "삭제할 검사 작업(task)의 UUID.",
            },
        },
        "required": ["task_id"],
    },
}
