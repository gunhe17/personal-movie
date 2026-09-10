"""AuthenticateService 잠금 시나리오 단위 테스트 (SaMD V&V)

InMemory mock으로 DB 의존성 없이 잠금 정책 로직 검증.
"""
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import (
    AccountLockedException,
    UnauthorizedException,
)
from app.modules.auth.account.models import Account
from app.modules.auth.account.services import (
    LOCKOUT_MINUTES,
    LOCKOUT_THRESHOLD,
    AuthenticateService,
)


def _make_account(
    *,
    password_hash: str = "hashed",
    is_active: bool = True,
    failed_attempts: int = 0,
    lockout_until: datetime | None = None,
) -> Account:
    """순수 모델 인스턴스 (DB 미접근)"""
    acc = Account(
        email="user@test.com",
        password_hash=password_hash,
        name="User",
    )
    acc.is_active = is_active
    acc.failed_login_attempts = failed_attempts
    acc.lockout_until = lockout_until
    return acc


def _make_repo(account: Account | None) -> AsyncMock:
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(return_value=account)
    repo.flush = AsyncMock()
    return repo


@pytest.fixture(autouse=True)
def _patch_verify_password(monkeypatch):
    """비밀번호 검증 mock — verify_password가 'correct'면 True"""
    def _verify(plain, _hash):
        return plain == "correct"
    monkeypatch.setattr(
        "app.modules.auth.account.services.verify_password", _verify
    )


class TestAuthenticateSuccess:
    async def test_correct_password_resets_counter(self):
        account = _make_account(failed_attempts=2)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        result = await service.execute("user@test.com", "correct", "1.2.3.4")

        assert result is account
        assert account.failed_login_attempts == 0
        assert account.lockout_until is None
        assert account.last_login_ip == "1.2.3.4"
        assert account.last_login_at is not None
        repo.flush.assert_awaited_once()


class TestAuthenticateFailure:
    async def test_account_not_found(self):
        repo = _make_repo(None)
        service = AuthenticateService(repo)

        with pytest.raises(UnauthorizedException):
            await service.execute("nobody@test.com", "anything")

    async def test_wrong_password_increments_counter(self):
        account = _make_account(failed_attempts=1)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        with pytest.raises(UnauthorizedException):
            await service.execute("user@test.com", "wrong")

        assert account.failed_login_attempts == 2
        assert account.lockout_until is None  # 아직 잠금 X

    async def test_threshold_triggers_lockout(self):
        account = _make_account(failed_attempts=LOCKOUT_THRESHOLD - 1)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        with pytest.raises(UnauthorizedException):
            await service.execute("user@test.com", "wrong")

        assert account.failed_login_attempts == LOCKOUT_THRESHOLD
        assert account.lockout_until is not None
        # 약 LOCKOUT_MINUTES 후 만료
        now = datetime.utcnow()
        delta = account.lockout_until - now
        assert timedelta(minutes=LOCKOUT_MINUTES - 1) < delta < timedelta(
            minutes=LOCKOUT_MINUTES + 1
        )

    async def test_locked_account_raises_locked(self):
        future = datetime.utcnow() + timedelta(minutes=10)
        account = _make_account(lockout_until=future, failed_attempts=5)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        with pytest.raises(AccountLockedException):
            await service.execute("user@test.com", "correct")

    async def test_expired_lockout_allows_login(self):
        """잠금 시각이 지났으면 정상 로그인 가능"""
        past = datetime.utcnow() - timedelta(minutes=1)
        account = _make_account(lockout_until=past, failed_attempts=5)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        result = await service.execute("user@test.com", "correct")

        assert result is account
        assert account.failed_login_attempts == 0
        assert account.lockout_until is None

    async def test_inactive_account(self):
        account = _make_account(is_active=False)
        repo = _make_repo(account)
        service = AuthenticateService(repo)

        with pytest.raises(UnauthorizedException, match="비활성"):
            await service.execute("user@test.com", "correct")
