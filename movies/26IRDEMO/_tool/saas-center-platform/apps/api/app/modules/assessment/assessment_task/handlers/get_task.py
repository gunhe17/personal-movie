from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import AssessmentTaskFacade
from ..schemas import TaskResponse, AssessmentInfo


async def get_task_handler(
    task_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> TaskResponse:
    facade = AssessmentTaskFacade(uow)
    await facade.get_task(task_id, center_id)

    result = await facade.get_task_with_assessment(task_id)

    # return
    task = result["task"]
    assessment_data = result["assessment"]

    task_response = TaskResponse.model_validate(task, from_attributes=True)
    task_response.assessment = AssessmentInfo(**assessment_data)

    return task_response


TOOL = {
    "name": "get_task_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 작업 한 건을 조회한다.",
    "keywords": ["작업 조회", "검사 task 상세", "task 조회"],
    "boundaries": "단건 작업 조회(읽기). 목록은 list_tasks_handler.",
    "output": "검사 작업 상세 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "조회할 검사 작업의 UUID.",
            },
        },
        "required": ["task_id"],
    },
}
