from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.handlers.assessment.restore_link_session import restore_link_session_handler
from app.core.exceptions import InvalidOperationException, UnauthorizedException
from app.modules.assessment.send_link.router import _require_link_claims


@pytest.mark.parametrize("claims", [None, {"aud": "staff", "send_link_id": "link"}, {"aud": "assessment_link", "send_link_id": "other"}])
def test_session_rejects_expired_wrong_audience_or_other_link_token(claims):
    with patch("app.modules.assessment.send_link.router.get_token") as token:
        token.return_value.decode_access_token.return_value = claims
        with pytest.raises(UnauthorizedException):
            _require_link_claims("Bearer token", "link")


@pytest.mark.asyncio
async def test_restore_rechecks_link_and_does_not_issue_new_token():
    link = SimpleNamespace(id="link", center_id="center", case_id="case", recipients=[])
    with patch("app.application.handlers.assessment.restore_link_session.SendLinkFacade") as facade, patch("app.application.handlers.assessment.restore_link_session.MemberInvitationFacade") as center, patch("app.application.handlers.assessment.restore_link_session.collect_link_schedules", AsyncMock(return_value=([], {}))):
        facade.return_value.get_active_link_public = AsyncMock(return_value=link)
        facade.return_value.collect_tasks = AsyncMock(return_value=SimpleNamespace(tasks=[], assessment_names={}))
        center.return_value.get_center_name = AsyncMock(return_value="센터")
        result = await restore_link_session_handler("link", object())
        facade.return_value.get_active_link_public.assert_awaited_once_with("link")
        assert result.access_token == ""
        facade.return_value.verify_and_collect_tasks.assert_not_called()


@pytest.mark.asyncio
async def test_revoked_link_does_not_restore_tasks():
    with patch("app.application.handlers.assessment.restore_link_session.SendLinkFacade") as facade:
        facade.return_value.get_active_link_public = AsyncMock(side_effect=InvalidOperationException("revoked"))
        with pytest.raises(InvalidOperationException):
            await restore_link_session_handler("link", object())
        facade.return_value.collect_tasks.assert_not_called()
