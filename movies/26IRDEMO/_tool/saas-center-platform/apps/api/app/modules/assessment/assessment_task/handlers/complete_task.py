from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentCaseFacade, AssessmentTaskFacade
from ..schemas import TaskResponse


async def complete_task_handler(
    center_id: str,
    case_id: str,
    assessment_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> TaskResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentCaseFacade(uow).verify_case_writable(
        center_id, case_id, owner_scope
    )

    facade = AssessmentTaskFacade(uow)
    atomics, task = await facade.complete_task(center_id, case_id, assessment_id)
    await emit(
        uow,
        "assessment_task_completed",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return TaskResponse.model_validate(task, from_attributes=True)


TOOL = {
    "name": "complete_task_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 작업을 완료 처리한다.",
    "keywords": ["complete task", "작업 완료", "검사 task 완료", "task 완료"],
    "boundaries": "검사 작업 완료. 되돌리기는 revert_task_handler.",
    "output": "완료 처리된 검사 작업 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "검사 케이스의 UUID.",
            },
            "assessment_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사",
                "description": "완료할 검사의 UUID.",
            },
        },
        "required": ["case_id", "assessment_id"],
    },
}
