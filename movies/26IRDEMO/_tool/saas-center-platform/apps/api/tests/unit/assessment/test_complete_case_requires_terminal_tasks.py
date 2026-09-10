"""M3 회귀: 케이스 완료는 모든 Task(거부/취소 포함)가 종결돼야 한다.
non-terminal Task가 하나라도 있으면 complete 핸들러 가드가 막는다.
가드는 핸들러가 AssessmentTaskRepository.list_by_case 로 로드해 검사하므로
그 lookup + TERMINAL_TASK_STATUSES 술어를 실 세션으로 고정한다."""
import pytest

from app.core.exceptions import InvalidOperationException
from app.modules.assessment.assessment_case.handlers.complete_assessment_case import (
    TERMINAL_TASK_STATUSES,
)
from app.modules.assessment.assessment_case.repository import AssessmentCaseRepository
from app.modules.assessment.assessment_task.repository import AssessmentTaskRepository


async def _guard(task_repo: AssessmentTaskRepository, case_id: str) -> None:
    tasks = await task_repo.list_by_case(case_id)
    if any(t.status not in TERMINAL_TASK_STATUSES for t in tasks):
        raise InvalidOperationException("아직 종결되지 않은 검사가 있습니다")


async def test_complete_blocked_when_task_not_terminal(test_session):
    case_repo = AssessmentCaseRepository(test_session)
    task_repo = AssessmentTaskRepository(test_session)

    case = await case_repo.add(center_id="center-1", case_code="C-1", counselor_id="m-1")
    await task_repo.add(center_id="center-1", case_id=case.id, assessment_id="a-1", status="completed")
    await task_repo.add(center_id="center-1", case_id=case.id, assessment_id="a-2", status="pending")

    with pytest.raises(InvalidOperationException):
        await _guard(task_repo, case.id)


async def test_complete_allowed_when_all_terminal(test_session):
    case_repo = AssessmentCaseRepository(test_session)
    task_repo = AssessmentTaskRepository(test_session)

    case = await case_repo.add(center_id="center-1", case_code="C-2", counselor_id="m-1")
    await task_repo.add(center_id="center-1", case_id=case.id, assessment_id="a-1", status="completed")
    await task_repo.add(center_id="center-1", case_id=case.id, assessment_id="a-2", status="refused")
    await task_repo.add(center_id="center-1", case_id=case.id, assessment_id="a-3", status="cancelled")

    # 모두 terminal → 가드 통과(예외 없음)
    await _guard(task_repo, case.id)
