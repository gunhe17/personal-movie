from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import AssessmentTaskFacade
from ...assessment_case.repository import AssessmentCaseRepository
from ...assessment_case.services import GetAssessmentCaseService
from ..schemas import TaskResponse, AssessmentInfo


async def list_tasks_handler(
    center_id: str,
    case_id: str,
    execution_method: str | None,
    uow: UnitOfWork,
) -> list[TaskResponse]:
    # IDOR 방지: case 가 이 center 소유인지 먼저 검증(타 센터 case_id → 404).
    # list_by_case 는 case_id 만으로 조회하므로 여기서 테넌시를 강제한다.
    await GetAssessmentCaseService(uow.repo(AssessmentCaseRepository)).execute(
        center_id, case_id
    )

    facade = AssessmentTaskFacade(uow)
    tasks_with_assessments = await facade.list_tasks(case_id, execution_method)

    # return (uow 내부에서 엔티티 속성 접근)
    result = []
    for item in tasks_with_assessments:
        task = item["task"]
        assessment = item["assessment"]

        task_response = TaskResponse.model_validate(task, from_attributes=True)

        if assessment:
            task_response.assessment = AssessmentInfo.model_validate(
                assessment, from_attributes=True
            )

        result.append(task_response)

    return result


TOOL = {
    "name": "list_tasks_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스의 작업 목록을 조회한다.",
    "keywords": ["작업 목록", "검사 task 리스트", "task 목록"],
    "boundaries": "케이스 작업 목록(읽기). 단건은 get_task_handler.",
    "output": "검사 케이스 작업 목록 (TaskResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "작업을 조회할 검사 케이스의 UUID.",
            },
            "execution_method": {
                "type": "string",
                "title": "실행 방식 필터",
                "description": "실행 방식 필터(선택).",
            },
        },
        "required": ["case_id"],
    },
}
