from app.modules.assessment.assessment_case.models import CaseStatus
from app.modules.assessment.assessment_session.models import SessionStatus
from app.modules.assessment.assessment_task.models import TaskStatus
from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit

from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
)
from app.modules.schedule.facade import ScheduleFacade


async def delete_assessment_case_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> MessageResponse:
    # 삭제는 "처음부터 잘못 만든 케이스" 정리 전용 — 진행 기록(출석·제출 등)이 있으면 불가
    case_facade = AssessmentCaseFacade(uow)
    task_facade = AssessmentTaskFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # 삭제도 주담당 전용 — 참여 검사자는 열람만
    await case_facade.verify_case_writable(center_id, case_id, owner_scope)

    case = await case_facade.get_case_by_id(center_id, case_id)

    if case.status in (CaseStatus.COMPLETED, CaseStatus.CANCELLED):
        raise InvalidOperationException(
            "종결/취소된 검사는 삭제할 수 없어요.\n기록 보존을 위해 보관됩니다."
        )

    if case.status == CaseStatus.PROCESSING:
        raise InvalidOperationException(
            "진행 중인 검사는 삭제할 수 없어요.\n"
            "진행 기록이 없는 검사만 삭제할 수 있어요."
        )

    sessions = await case_facade.get_sessions_by_case_id(case_id)
    started_sessions = [s for s in sessions if s.status != SessionStatus.SCHEDULED]
    if started_sessions:
        attended = sum(
            1 for s in started_sessions if s.status == SessionStatus.ATTENDED
        )
        no_show = sum(1 for s in started_sessions if s.status == SessionStatus.NOSHOW)
        cancelled = sum(
            1 for s in started_sessions if s.status == SessionStatus.CANCELLED
        )

        parts = []
        if attended:
            parts.append(f"출석 {attended}건")
        if no_show:
            parts.append(f"노쇼 {no_show}건")
        if cancelled:
            parts.append(f"취소 {cancelled}건")

        raise InvalidOperationException(
            f"진행된 검사 일정이 있어 삭제할 수 없어요. ({', '.join(parts)})\n"
            "진행 기록이 없는 검사만 삭제할 수 있어요."
        )

    if sessions:
        session_ids = [s.id for s in sessions]
        participants = await session_facade.get_participants_by_session_ids(session_ids)
        attended_participants = [
            p for p in participants if p.attendance_status != "scheduled"
        ]
        if attended_participants:
            raise InvalidOperationException(
                "출석 기록이 있어 삭제할 수 없어요.\n"
                "진행 기록이 없는 검사만 삭제할 수 있어요."
            )

    tasks = await task_facade.get_tasks_by_case_id(case_id)
    started_tasks = [t for t in tasks if t.status != TaskStatus.PENDING]
    if started_tasks:
        in_progress = sum(
            1 for t in started_tasks if t.status == TaskStatus.IN_PROGRESS
        )
        submitted = sum(1 for t in started_tasks if t.status == TaskStatus.SUBMITTED)
        completed = sum(1 for t in started_tasks if t.status == TaskStatus.COMPLETED)
        cancelled = sum(1 for t in started_tasks if t.status == TaskStatus.CANCELLED)

        parts = []
        if in_progress:
            parts.append(f"진행 중 {in_progress}건")
        if submitted:
            parts.append(f"제출 {submitted}건")
        if completed:
            parts.append(f"완료 {completed}건")
        if cancelled:
            parts.append(f"취소 {cancelled}건")

        raise InvalidOperationException(
            f"진행된 검사 항목이 있어 삭제할 수 없어요. ({', '.join(parts)})\n"
            "진행 기록이 없는 검사만 삭제할 수 있어요."
        )

    schedule_ids = (
        [s.schedule_id for s in sessions if s.schedule_id] if sessions else []
    )

    case_atomic, _ = await case_facade.delete_case(center_id, case_id)
    participant_atomics, _ = await case_facade.delete_participants_by_case(case_id)
    task_atomics, _ = await task_facade.delete_tasks_by_case(case_id)
    session_atomics = []
    if sessions:
        (
            session_atomics,
            _schedule_ids,
        ) = await session_facade.delete_sessions_and_participants(case_id)
    schedule_deleted_atomics = []
    if schedule_ids:
        schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
            schedule_ids
        )

    await emit(
        uow,
        "assessment_case_deleted",
        event_group_id=event_group_id,
        atomics=[
            case_atomic,
            *participant_atomics,
            *task_atomics,
            *session_atomics,
            *schedule_deleted_atomics,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    return MessageResponse(message="검사 케이스가 삭제되었습니다")


TOOL = {
    "name": "delete_assessment_case_handler",
    "permission": "delete:assessment_case",
    "purpose": "검사 케이스를 삭제한다.",
    "keywords": [
        "delete assessment case",
        "검사 케이스 삭제",
        "검사 삭제",
        "케이스 제거",
        "검사 취소 삭제",
        "평가 삭제",
    ],
    "boundaries": "검사 '케이스' 전체를 삭제한다. 케이스 안 개별 작업(task)은 delete_assessment_task_handler. 상태만 되돌리려면 revert_cancel_case_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "삭제할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
