from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentTaskFacade
from ..schemas import TaskResponse


async def revert_cancel_task_handler(
    task_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> TaskResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentTaskFacade(uow).verify_task_writable(
        center_id, task_id, owner_scope
    )

    facade = AssessmentTaskFacade(uow)
    atomics, task = await facade.revert_cancel_task(task_id, center_id)
    await emit(
        uow,
        "assessment_task_cancel_reverted",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return TaskResponse.model_validate(task, from_attributes=True)


TOOL = {
    "name": "revert_cancel_task_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 작업을 롤백한다.",
    "keywords": ["rollback task", "작업 롤백", "task rollback", "검사 단계 복구"],
    "boundaries": "검사 작업을 롤백한다. 단순 되돌리기는 revert_task_handler.",
    "output": "롤백된 검사 작업 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "롤백할 검사 작업의 UUID.",
            },
        },
        "required": ["task_id"],
    },
}
