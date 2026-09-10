"""VerifyCaseAccessService — 검사 케이스 열람/쓰기 스코프 분리 검증.

열람 = 주담당 + 참여 검사자, 쓰기 = 주담당 전용. 상담(VerifyCaseReadableService)과 같은 규칙이다.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.assessment.assessment_case.services import VerifyCaseAccessService

PRIMARY = "MEMBER_PRIMARY"
ASSISTANT = "MEMBER_ASSISTANT"
STRANGER = "MEMBER_STRANGER"


def _service():
    case_repo = MagicMock()
    case_repo.get_in_center = AsyncMock(
        return_value=MagicMock(counselor_id=PRIMARY)
    )
    participant_repo = MagicMock()
    participant_repo.list_by_case_and_type = AsyncMock(
        return_value=[MagicMock(participant_id=ASSISTANT)]
    )
    return VerifyCaseAccessService(case_repo, participant_repo), participant_repo


async def test_manager_passes_without_case_lookup():
    service, _ = _service()
    # member_id None = access_level=all — 스코프 검사 자체가 없다
    await service.execute("C1", "CASE1", member_id=None)
    service.case_repo.get_in_center.assert_not_called()


async def test_primary_can_read_and_write():
    service, _ = _service()
    await service.execute("C1", "CASE1", member_id=PRIMARY)
    await service.execute("C1", "CASE1", member_id=PRIMARY, writable=True)


async def test_assistant_can_read_but_not_write():
    service, participant_repo = _service()

    await service.execute("C1", "CASE1", member_id=ASSISTANT)

    with pytest.raises(EntityNotFoundException):
        await service.execute("C1", "CASE1", member_id=ASSISTANT, writable=True)

    # 쓰기 판정은 주담당 컬럼만 보므로 참여자 조회까지 가지 않는다
    assert participant_repo.list_by_case_and_type.await_count == 1


async def test_stranger_is_blocked_both_ways():
    service, _ = _service()

    with pytest.raises(EntityNotFoundException):
        await service.execute("C1", "CASE1", member_id=STRANGER)

    with pytest.raises(EntityNotFoundException):
        await service.execute("C1", "CASE1", member_id=STRANGER, writable=True)
