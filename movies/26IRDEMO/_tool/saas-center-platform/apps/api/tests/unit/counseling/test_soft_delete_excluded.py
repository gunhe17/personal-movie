"""회귀: counseling repo의 원시 select 쿼리가 soft-deleted 행을 누설하던 결함.
remove_by_id(soft delete) 후 조회에서 삭제 행이 빠져야 한다."""
from datetime import datetime

from app.modules.counseling.counseling_case_participant.repository import (
    CounselingCaseParticipantRepository,
)
from app.modules.counseling.counseling_session.repository import (
    CounselingSessionRepository,
)


async def test_count_by_case_excludes_soft_deleted_session(test_session):
    center_id = "center-1"
    case_id = "case-1"
    repo = CounselingSessionRepository(test_session)

    kept = await repo.add(
        center_id=center_id,
        counseling_case_id=case_id,
        schedule_id="sched-1",
        status="scheduled",
    )
    removed = await repo.add(
        center_id=center_id,
        counseling_case_id=case_id,
        schedule_id="sched-2",
        status="scheduled",
    )
    await test_session.commit()

    assert await repo.count_by_case(case_id=case_id, center_id=center_id) == 2

    await repo.remove_by_id(removed.id)
    await test_session.commit()

    assert await repo.count_by_case(case_id=case_id, center_id=center_id) == 1
    assert kept.id != removed.id


async def test_list_by_case_excludes_soft_deleted_participant(test_session):
    center_id = "center-1"
    case_id = "case-1"
    repo = CounselingCaseParticipantRepository(test_session)

    kept = await repo.add(
        center_id=center_id,
        counseling_case_id=case_id,
        participant_id="p-1",
        participant_type="client",
        is_active=True,
        joined_at=datetime(2026, 1, 1),
    )
    removed = await repo.add(
        center_id=center_id,
        counseling_case_id=case_id,
        participant_id="p-2",
        participant_type="client",
        is_active=True,
        joined_at=datetime(2026, 1, 1),
    )
    await test_session.commit()

    await repo.remove_by_id(removed.id)
    await test_session.commit()

    result = await repo.list_by_case(case_id=case_id, center_id=center_id)
    ids = {p.id for p in result}
    assert kept.id in ids
    assert removed.id not in ids
