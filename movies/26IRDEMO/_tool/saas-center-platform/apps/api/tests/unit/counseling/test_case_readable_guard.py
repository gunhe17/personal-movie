"""VerifyCaseReadableService — 상담 케이스 열람 스코프 검증.

열람 = 주담당 + 활성 공동 상담사. 쓰기는 이 서비스를 거치지 않고 기존 owner_scope
(주담당 컬럼 비교)가 그대로 막는다 — 그래서 부담당은 열람만 된다.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.counseling.counseling_case.services import VerifyCaseReadableService

PRIMARY = "MEMBER_PRIMARY"
ASSISTANT = "MEMBER_ASSISTANT"
STRANGER = "MEMBER_STRANGER"


def _service():
    case_repo = MagicMock()
    case_repo.get_in_center = AsyncMock(return_value=MagicMock(counselor_id=PRIMARY))
    participant_repo = MagicMock()
    participant_repo.list_by_case = AsyncMock(
        return_value=[MagicMock(participant_id=ASSISTANT)]
    )
    return VerifyCaseReadableService(case_repo, participant_repo), participant_repo


async def test_manager_passes_without_case_lookup():
    service, _ = _service()
    # member_id None = access_level=all — 스코프 검사 자체가 없다
    await service.execute("CASE1", "C1", member_id=None)
    service.case_repo.get_in_center.assert_not_called()


async def test_primary_passes_without_participant_lookup():
    service, participant_repo = _service()
    await service.execute("CASE1", "C1", member_id=PRIMARY)
    participant_repo.list_by_case.assert_not_called()


async def test_active_co_counselor_passes():
    service, participant_repo = _service()
    await service.execute("CASE1", "C1", member_id=ASSISTANT)
    # 활성 상담사 참여자만 대상 (이탈자는 제외)
    kwargs = participant_repo.list_by_case.await_args.kwargs
    assert kwargs["active_only"] is True
    assert kwargs["participant_type"] == "counselor"


async def test_stranger_is_blocked():
    service, _ = _service()
    with pytest.raises(EntityNotFoundException):
        await service.execute("CASE1", "C1", member_id=STRANGER)
