"""노쇼 처리 — atomic 팩토리 호출·act 철자 회귀 가드 (D14 no_show 수렴)."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.modules.assessment.assessment_session.models import SessionStatus
from app.modules.assessment.assessment_session.services.no_show_session import NoShowSessionService


@pytest.mark.asyncio
async def test_no_show_returns_atomic_with_no_show_act():
    session = MagicMock()
    session.status = SessionStatus.SCHEDULED
    repo = AsyncMock()
    repo.get_in_center.return_value = session
    repo.update_in_center.return_value = session

    atomic, result = await NoShowSessionService(repo).execute(
        center_id="c1",
        session_id="s1",
    )

    assert result is session
    assert atomic.act() == "no_show"
    repo.update_in_center.assert_awaited_once_with(
        session_id="s1",
        center_id="c1",
        status=SessionStatus.NO_SHOW,
    )
