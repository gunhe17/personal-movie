from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentTaskFacade
from ..schemas import TaskResponse


async def update_task_opinion_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    task_id: str,
    opinion: str | None,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
) -> TaskResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentTaskFacade(uow).verify_task_writable(
        center_id, task_id, owner_scope
    )

    facade = AssessmentTaskFacade(uow)
    atomic, task = await facade.update_task_opinion(
        center_id=center_id,
        task_id=task_id,
        opinion=opinion,
    )
    await emit(
        uow,
        "assessment_task_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return TaskResponse.model_validate(task, from_attributes=True)
