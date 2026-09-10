"""VerifySendResultService 단위 테스트.

결과전송 인증 코드 검증의 모든 분기를 mocked repo 로 검증한다:
조회 실패 / 무효화 / 만료 / 시도횟수 초과 / 코드 불일치(실패횟수 증가) / 성공.
"""
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.modules.assessment.send_result.services.verify_send_result import (
    MAX_FAILED_ATTEMPTS,
    VerifySendResultService,
)


def _make_send_result(
    *,
    verification_code: str = "1234",
    revoked_at=None,
    expires_at=None,
    failed_attempts: int = 0,
) -> MagicMock:
    sr = MagicMock()
    sr.verification_code = verification_code
    sr.revoked_at = revoked_at
    sr.expires_at = expires_at
    sr.failed_attempts = failed_attempts
    return sr


class TestVerifySendResultService:
    @pytest.fixture
    def repo(self):
        repo = AsyncMock()
        repo.get_by_id_public = AsyncMock()
        repo.increment_failed_attempts = AsyncMock()
        return repo

    @pytest.fixture
    def service(self, repo):
        return VerifySendResultService(repo)

    async def test_not_found_raises(self, service, repo):
        repo.get_by_id_public.side_effect = EntityNotFoundException("missing")

        with pytest.raises(EntityNotFoundException):
            await service.execute("missing-id", "1234")

    async def test_revoked_raises(self, service, repo):
        repo.get_by_id_public.return_value = _make_send_result(revoked_at=utc_now())

        with pytest.raises(InvalidOperationException, match="무효화"):
            await service.execute("sr-1", "1234")

    async def test_expired_raises(self, service, repo):
        repo.get_by_id_public.return_value = _make_send_result(
            expires_at=utc_now() - timedelta(hours=1)
        )

        with pytest.raises(InvalidOperationException, match="만료"):
            await service.execute("sr-1", "1234")

    async def test_too_many_failed_attempts_raises(self, service, repo):
        repo.get_by_id_public.return_value = _make_send_result(
            failed_attempts=MAX_FAILED_ATTEMPTS
        )

        with pytest.raises(InvalidOperationException, match="초과"):
            await service.execute("sr-1", "1234")
        repo.increment_failed_attempts.assert_not_called()

    async def test_wrong_code_increments_and_raises_with_remaining(self, service, repo):
        repo.get_by_id_public.return_value = _make_send_result(verification_code="1234")
        repo.increment_failed_attempts.return_value = 2  # 새 실패 횟수

        with pytest.raises(InvalidOperationException, match="남은 시도: 3회"):
            await service.execute("sr-1", "9999")
        repo.increment_failed_attempts.assert_awaited_once_with(send_result_id="sr-1")

    async def test_valid_code_returns_entity(self, service, repo):
        send_result = _make_send_result(verification_code="1234")
        repo.get_by_id_public.return_value = send_result

        result = await service.execute("sr-1", "1234")

        assert result is send_result
        repo.increment_failed_attempts.assert_not_called()
