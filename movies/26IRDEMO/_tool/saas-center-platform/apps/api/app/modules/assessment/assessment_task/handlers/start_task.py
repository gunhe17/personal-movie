from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentTaskFacade
from ..schemas import TaskResponse, AssessmentInfo


async def start_task_handler(
    task_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
    owner_scope: str | None = None,
) -> TaskResponse:
    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentTaskFacade(uow).verify_task_writable(
        center_id, task_id, owner_scope
    )

    facade = AssessmentTaskFacade(uow)
    await facade.get_task(task_id, center_id)

    atomics, result = await facade.start_task_with_assessment(task_id)
    await emit(
        uow,
        "assessment_task_started",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    # return
    task = result["task"]
    assessment_data = result["assessment"]

    task_response = TaskResponse.model_validate(task, from_attributes=True)
    task_response.assessment = AssessmentInfo(**assessment_data)

    return task_response


TOOL = {
    "name": "start_task_handler",
    "permission": "read:assessment_case",
    "agent_exposed": False,
    "purpose": "검사 작업을 시작한다 (pending이면 in_progress로 전환).",
    "keywords": ["검사 작업 시작", "task 시작", "start task"],
    "boundaries": "검사 작업을 여는 순간의 시작 전이(UI 트리거, 부작용 있음). 부작용 없는 단건 조회는 get_task_handler, 제출은 submit_task_handler.",
    "output": "시작된 검사 작업 상세 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "시작할 검사 작업의 UUID.",
            },
        },
        "required": ["task_id"],
    },
}
