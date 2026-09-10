from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentTaskFacade
from ..schemas import TaskResponse, TaskRefuse


async def refuse_task_handler(
    *,
    event_group_id: uuid_str,
    task_id: str,
    center_id: str,
    data: TaskRefuse,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
) -> TaskResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentTaskFacade(uow).verify_task_writable(
        center_id, task_id, owner_scope
    )

    facade = AssessmentTaskFacade(uow)
    atomics, task = await facade.refuse_task(task_id, center_id, data.reason)
    await emit(
        uow,
        "assessment_task_refused",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return TaskResponse.model_validate(task, from_attributes=True)


TOOL = {
    "name": "refuse_task_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 작업을 거부 처리한다.",
    "keywords": ["refuse task", "작업 거부", "검사 거부", "task refuse"],
    "boundaries": "검사 작업을 '거부' 처리. 취소는 cancel_task_handler.",
    "output": "거부 처리된 검사 작업 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "거부할 검사 작업의 UUID.",
            },
            "reason": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "거부 사유",
            },
        },
        "required": ["task_id"],
    },
}
