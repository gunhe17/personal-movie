from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import AssessmentCaseRepository
from ..services import CompleteAssessmentCaseService, VerifyCaseAccessService
from ..schemas import AssessmentCaseResponse
from ...assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)
from ...assessment_task.repository import AssessmentTaskRepository


TERMINAL_TASK_STATUSES = {"completed", "refused", "cancelled"}


async def complete_assessment_case_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> AssessmentCaseResponse:
    # 수정은 주담당 전용 — 참여 검사자는 열람만
    await VerifyCaseAccessService(
        uow.repo(AssessmentCaseRepository),
        uow.repo(AssessmentCaseParticipantRepository),
    ).execute(center_id, case_id, member_id=owner_scope, writable=True)

    # 모든 검사(거부/취소 포함)가 종결돼야 케이스를 완료할 수 있다.
    tasks = await uow.repo(AssessmentTaskRepository).list_by_case(case_id)
    if any(t.status not in TERMINAL_TASK_STATUSES for t in tasks):
        raise InvalidOperationException("아직 종결되지 않은 검사가 있습니다")

    repo = uow.repo(AssessmentCaseRepository)
    service = CompleteAssessmentCaseService(repo)

    case_atomic, case = await service.execute(center_id, case_id)
    await emit(
        uow,
        "assessment_case_completed",
        event_group_id=event_group_id,
        atomics=[case_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentCaseResponse.model_validate(case, from_attributes=True)


TOOL = {
    "name": "complete_assessment_case_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 케이스를 완료 처리한다.",
    "keywords": [
        "complete assessment case",
        "검사 완료",
        "케이스 완료",
        "검사 종료",
        "complete case",
    ],
    "boundaries": "검사 케이스를 '완료'로 마감한다. 생성/수정/삭제는 application/handlers/assessment 쪽.",
    "output": "완료 처리된 검사 케이스 (AssessmentCaseResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "완료 처리할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
