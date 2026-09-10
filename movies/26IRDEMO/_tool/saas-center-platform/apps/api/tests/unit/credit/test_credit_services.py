"""크레딧 서비스 단위 테스트.

tokens_to_credits, DeductCreditService, VerifyQuotaService,
CreateLlmCallService 동작을 검증한다.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.llm.credit_balance.services import (
    tokens_to_credits,
    DeductCreditService,
    VerifyQuotaService,
    InitializeCreditService,
    RollCreditPeriodService,
)
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.llm.credit_balance.plan_config import (
    AIPurpose,
    FREE_PURPOSES,
    PURPOSE_ESTIMATED_CREDITS,
    TOKENS_PER_CREDIT,
)
from app.core.exceptions import InvalidOperationException, QuotaExceededException


# ── tokens_to_credits ──


class TestTokensToCredits:
    def test_exact_division(self):
        assert tokens_to_credits(2000, 2000) == 1

    def test_ceiling_division(self):
        assert tokens_to_credits(2001, 2000) == 2

    def test_minimum_one(self):
        assert tokens_to_credits(1, 2000) == 1

    def test_zero_tokens_returns_one(self):
        # 0 토큰도 최소 1 크레딧 (min 함수)
        assert tokens_to_credits(0, 2000) == 1

    def test_large_tokens(self):
        assert tokens_to_credits(10000, 2000) == 5

    def test_custom_rate(self):
        assert tokens_to_credits(500, 1000) == 1
        assert tokens_to_credits(1001, 1000) == 2


# ── DeductCreditService ──


class TestDeductCreditService:
    @pytest.fixture
    def mock_repo(self):
        repo = AsyncMock()
        repo.flush = AsyncMock()
        return repo

    @pytest.fixture
    def service(self, mock_repo):
        return DeductCreditService(mock_repo)

    async def test_deducts_credits(self, service, mock_repo):
        """유료 호출 시 credit_used가 증가한다."""
        balance = MagicMock(spec=CreditBalance)
        balance.credit_used = 10
        balance.credit_limit = 100
        mock_repo.find_active_for_update.return_value = balance

        atomic, rate, charged = await service.execute("center-1", 4000, rate=2000)

        assert atomic is not None
        assert rate == 2000
        assert charged == 2  # 4000 / 2000 = 2
        mock_repo.update_in_place.assert_awaited_once_with(balance.id, credit_used=12)  # 10 + 2

    async def test_no_active_balance(self, service, mock_repo):
        """활성 크레딧 레코드 없으면 차감 안 함."""
        mock_repo.find_active_for_update.return_value = None

        atomic, rate, charged = await service.execute("center-1", 4000, rate=2000)

        assert atomic is None
        assert rate == 2000
        assert charged == 2  # 크레딧은 계산되지만 반영 안 됨

    async def test_overflow_allowed(self, service, mock_repo):
        """한도 초과 시에도 차감이 수행된다 (overflow 허용)."""
        balance = MagicMock(spec=CreditBalance)
        balance.credit_used = 99
        balance.credit_limit = 100
        mock_repo.find_active_for_update.return_value = balance

        _atomic, rate, charged = await service.execute("center-1", 4000, rate=2000)

        assert charged == 2
        mock_repo.update_in_place.assert_awaited_once_with(balance.id, credit_used=101)  # 99 + 2 > 100 (overflow)


# ── VerifyQuotaService ──


class TestVerifyQuotaService:
    @pytest.fixture
    def mock_repo(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_repo):
        return VerifyQuotaService(mock_repo)

    async def test_free_purpose_always_passes(self, service, mock_repo):
        """무료 purpose는 잔량 체크 없이 통과."""
        for purpose in FREE_PURPOSES:
            await service.execute("center-1", purpose)
        mock_repo.find_active_by_center.assert_not_called()

    async def test_paid_purpose_with_sufficient_credit(self, service, mock_repo):
        """잔량 충분하면 통과."""
        balance = MagicMock(spec=CreditBalance)
        balance.credit_limit = 100
        balance.credit_used = 10
        mock_repo.find_active_by_center.return_value = balance

        await service.execute("center-1", AIPurpose.FIELD_NOTE_SUMMARIZE)

    async def test_paid_purpose_insufficient_credit(self, service, mock_repo):
        """잔량 부족하면 QuotaExceededException."""
        balance = MagicMock(spec=CreditBalance)
        balance.credit_limit = 100
        balance.credit_used = 99  # remaining=1, estimated=2
        mock_repo.find_active_by_center.return_value = balance

        with pytest.raises(QuotaExceededException):
            await service.execute("center-1", AIPurpose.FIELD_NOTE_SUMMARIZE)

    async def test_unknown_purpose_rejected(self, service, mock_repo):
        """미등록 purpose는 InvalidOperationException."""
        with pytest.raises(InvalidOperationException, match="Unknown AI purpose"):
            await service.execute("center-1", "unknown_purpose")

    async def test_no_credit_record_blocks_paid(self, service, mock_repo):
        """유료 purpose인데 크레딧 레코드 없으면 차단(fail-closed).

        모든 센터는 프로비저닝 시 balance를 받으므로, 없음 = Free/만료 전환분(지갑 삭제).
        """
        mock_repo.find_active_by_center.return_value = None

        with pytest.raises(QuotaExceededException):
            await service.execute("center-1", AIPurpose.SKILL_SELECTION)


# ── plan_config 일관성 ──


class TestPlanConfigConsistency:
    def test_free_purposes_not_in_estimated(self):
        """FREE_PURPOSES는 PURPOSE_ESTIMATED_CREDITS에 없어야 한다."""
        overlap = FREE_PURPOSES & set(PURPOSE_ESTIMATED_CREDITS.keys())
        assert overlap == set(), (
            f"FREE_PURPOSES와 PURPOSE_ESTIMATED_CREDITS 중복: {overlap}. "
            "무료 purpose는 크레딧 예상치가 불필요합니다."
        )

    def test_all_paid_purposes_have_estimates(self):
        """유료 purpose는 모두 PURPOSE_ESTIMATED_CREDITS에 등록되어야 한다."""
        all_purposes = set(AIPurpose)
        paid_purposes = all_purposes - FREE_PURPOSES
        missing = paid_purposes - set(PURPOSE_ESTIMATED_CREDITS.keys())
        assert missing == set(), (
            f"유료 purpose에 예상 크레딧이 미등록: {missing}. "
            "VerifyQuotaService가 기본값 1을 사용하게 됩니다."
        )

    def test_all_purposes_are_valid_str_enum(self):
        """모든 AIPurpose 값이 문자열로 비교 가능해야 한다."""
        for p in AIPurpose:
            assert isinstance(p, str)
            assert p == p.value
