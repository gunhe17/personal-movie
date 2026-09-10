"""H3 회귀: soft-delete된 center_assessment 슬롯 위 재등록은 복원되어야 한다
(blind INSERT → full-unique IntegrityError 방지)."""
import pytest

from app.core.exceptions import ConflictException
from app.modules.assessment.center_assessment.repository import CenterAssessmentRepository
from app.modules.assessment.center_assessment.services.create_center_assessment import (
    CreateCenterAssessmentService,
)


async def test_recreate_after_softdelete_restores(test_session):
    repo = CenterAssessmentRepository(test_session)
    svc = CreateCenterAssessmentService(repo)

    _atomic, ca = await svc.execute(center_id="center-1", assessment_id="assess-1")
    await repo.remove_by_id(ca.id)  # soft delete (unassign)

    # 재등록 — 이전엔 IntegrityError, 이제 복원
    _atomic2, ca2 = await svc.execute(center_id="center-1", assessment_id="assess-1")
    assert ca2.id == ca.id
    assert ca2.deleted_at is None


async def test_recreate_active_still_conflicts(test_session):
    repo = CenterAssessmentRepository(test_session)
    svc = CreateCenterAssessmentService(repo)
    await svc.execute(center_id="center-1", assessment_id="assess-2")
    with pytest.raises(ConflictException):
        await svc.execute(center_id="center-1", assessment_id="assess-2")
