from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.assessment.send_link.services.verify_send_link import VerifySendLinkService
from app.modules.assessment.send_link.services.get_active_public_send_link import GetActivePublicSendLinkService


@pytest.mark.asyncio
@pytest.mark.parametrize("service_type", [VerifySendLinkService, GetActivePublicSendLinkService])
@pytest.mark.parametrize("expiry", [None, "future", "past"])
async def test_link_expiry_uses_model_field(service_type, expiry):
    link = SimpleNamespace(
        expires_at=None if expiry is None else utc_now() + timedelta(days=1 if expiry == "future" else -1),
        revoked_at=None, failed_attempts=0, verification_code="0123",
    )
    repo = AsyncMock()
    repo.get_by_id_public.return_value = link
    arguments = ("link", "0123") if service_type is VerifySendLinkService else ("link",)
    if expiry == "past":
        with pytest.raises(InvalidOperationException, match="만료"):
            await service_type(repo).execute(*arguments)
    else:
        assert await service_type(repo).execute(*arguments) is link
    repo.increment_failed_attempts.assert_not_awaited()


@pytest.mark.asyncio
async def test_only_wrong_code_increments_attempts():
    repo = AsyncMock()
    repo.get_by_id_public.return_value = SimpleNamespace(expires_at=None, revoked_at=None, failed_attempts=0, verification_code="0123")
    repo.increment_failed_attempts.return_value = 1
    with pytest.raises(InvalidOperationException, match="일치하지"):
        await VerifySendLinkService(repo).execute("link", "9999")
    repo.increment_failed_attempts.assert_awaited_once_with(send_link_id="link")


@pytest.mark.asyncio
async def test_successful_verification_does_not_consume_the_code():
    link = SimpleNamespace(expires_at=utc_now() + timedelta(days=1), revoked_at=None, failed_attempts=0, verification_code="0123")
    repo = AsyncMock()
    repo.get_by_id_public.return_value = link
    service = VerifySendLinkService(repo)
    assert await service.execute("link", "0123") is link
    assert await service.execute("link", "0123") is link
    assert link.failed_attempts == 0
    repo.increment_failed_attempts.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("revoked,attempts,message", [(True, 0, "무효화"), (False, 5, "횟수")])
async def test_revoked_and_locked_links_still_rejected(revoked, attempts, message):
    repo = AsyncMock()
    repo.get_by_id_public.return_value = SimpleNamespace(expires_at=None, revoked_at=utc_now() if revoked else None, failed_attempts=attempts, verification_code="0123")
    with pytest.raises(InvalidOperationException, match=message):
        await VerifySendLinkService(repo).execute("link", "0123")
    repo.increment_failed_attempts.assert_not_awaited()
