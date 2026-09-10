from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import AssessmentCaseFacade, AssessmentTaskFacade
from ..schemas import TaskResponse


async def revert_task_handler(
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
    atomics, task = await facade.revert_task(center_id, case_id, assessment_id)
    await emit(
        uow,
        "assessment_task_reverted",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return TaskResponse.model_validate(task, from_attributes=True)


TOOL = {
    "name": "revert_task_handler",
    "permission": "write:assessment_case",
    "purpose": "완료/처리한 검사 작업을 이전 상태로 되돌린다.",
    "keywords": ["revert task", "작업 되돌리기", "task revert", "검사 복구"],
    "boundaries": "검사 작업 상태를 되돌린다. 완료는 complete_task_handler, 더 깊은 롤백은 revert_cancel_task_handler.",
    "output": "이전 상태로 되돌린 검사 작업 (TaskResponse).",
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
                "description": "되돌릴 검사의 UUID.",
            },
        },
        "required": ["case_id", "assessment_id"],
    },
}
