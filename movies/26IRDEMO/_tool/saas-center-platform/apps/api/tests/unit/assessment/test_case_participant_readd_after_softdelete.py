"""§11 회귀: case_participant 재등록.
full unique(case,type,participant) 라 remove_by_case(soft delete) 후 재추가가
blind INSERT 면 IntegrityError. add_or_reassign 이 소프트삭제 행도 찾아 복원해야 한다."""
from app.modules.assessment.assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)


async def test_readd_after_softdelete_restores(test_session):
    repo = AssessmentCaseParticipantRepository(test_session)

    original = await repo.add(
        center_id="center-1",
        case_id="case-1",
        participant_type="client",
        participant_id="client-1",
    )

    # remove_by_case = soft delete (deleted_at 마킹)
    await repo.remove_by_case(case_id="case-1")

    # 재등록 — 이전엔 IntegrityError, 이제 복원
    restored = await repo.add_or_reassign(
        center_id="center-1",
        case_id="case-1",
        participant_type="client",
        participant_id="client-1",
    )

    assert restored.id == original.id
    assert restored.deleted_at is None
    assert restored.unassigned_at is None


async def test_readd_after_unassign_reassigns(test_session):
    repo = AssessmentCaseParticipantRepository(test_session)

    original = await repo.add(
        center_id="center-1",
        case_id="case-2",
        participant_type="assistant",
        participant_id="member-1",
    )
    await repo.update_unassigned(
        case_id="case-2",
        participant_type="assistant",
        participant_id="member-1",
    )

    restored = await repo.add_or_reassign(
        center_id="center-1",
        case_id="case-2",
        participant_type="assistant",
        participant_id="member-1",
    )

    assert restored.id == original.id
    assert restored.unassigned_at is None
    assert restored.deleted_at is None
