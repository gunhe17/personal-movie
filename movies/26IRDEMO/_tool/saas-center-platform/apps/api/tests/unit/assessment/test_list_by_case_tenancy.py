"""H1 회귀: list-by-case 테넌시 가드 — case 가 호출자 center 소유가 아니면 404.
list_tasks/list_sessions 핸들러가 의존하는 GetAssessmentCaseService 의 center 스코프를 고정한다."""
import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.assessment.assessment_case.repository import AssessmentCaseRepository
from app.modules.assessment.assessment_case.services import GetAssessmentCaseService


async def test_get_case_rejects_foreign_center(test_session):
    repo = AssessmentCaseRepository(test_session)
    case = await repo.add(center_id="center-A", case_code="C-1", counselor_id="counselor-1")

    svc = GetAssessmentCaseService(repo)
    got = await svc.execute("center-A", case.id)
    assert got.id == case.id

    # 타 센터 case_id → 404 (list_tasks/list_sessions 가 이 가드를 호출해 IDOR 차단)
    with pytest.raises(EntityNotFoundException):
        await svc.execute("center-B", case.id)
