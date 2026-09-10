"""LlmCall 기록 + 크레딧 차감 조율 — 소유자는 RecordLlmCallService (facade thin pass-through).

(이전엔 AddLlmCallService가 repo._session으로 타 repo를 자가 생성해 차감까지 했음 —
검수에서 facade 소유로 재배치. Agent 이중차감 방지 계약은 동일하게 유지.)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.llm.credit_balance.plan_config import FREE_PURPOSES, AIPurpose
from app.modules.llm.facade.llm_call_facade import LlmCallFacade


class FakeUow:
    def __init__(self):
        self.repos = {}

    def repo(self, cls):
        return self.repos.setdefault(cls.__name__, AsyncMock())


@pytest.fixture
def uow():
    return FakeUow()


@pytest.fixture
def facade(uow):
    return LlmCallFacade(uow)


def _patches():
    rate_svc = AsyncMock()
    rate_svc.execute.return_value = 2000
    deduct_svc = AsyncMock()
    deduct_svc.execute.return_value = (None, 2000, 3)  # (atomic, rate, credits)
    p1 = patch(
        "app.modules.llm.llm_call.services.record_llm_call.GetTokensPerCreditService",
        return_value=rate_svc,
    )
    p2 = patch(
        "app.modules.llm.llm_call.services.record_llm_call.DeductCreditService",
        return_value=deduct_svc,
    )
    return p1, p2, rate_svc, deduct_svc


class TestAddLlmCall:
    async def test_paid_purpose_deducts_and_records(self, facade, uow):
        p1, p2, _, deduct_svc = _patches()
        with p1, p2:
            await facade.add_llm_call(
                session_id="conv-1",
                model="gpt-4o",
                input_tokens=3000,
                output_tokens=1000,
                purpose=AIPurpose.SKILL_SELECTION,
                center_id="center-1",
                member_id="member-1",
            )

        deduct_svc.execute.assert_called_once_with(
            center_id="center-1", tokens_used=4000, rate=2000,
        )
        add_kwargs = uow.repos["LlmCallRepository"].add.call_args.kwargs
        assert add_kwargs["credits_charged"] == 3
        assert add_kwargs["tokens_per_credit"] == 2000

    async def test_free_purpose_no_deduction(self, facade, uow):
        p1, p2, _, deduct_svc = _patches()
        with p1, p2:
            await facade.add_llm_call(
                input_tokens=100,
                output_tokens=100,
                purpose=next(iter(FREE_PURPOSES)),
                center_id="center-1",
            )

        deduct_svc.execute.assert_not_called()
        assert uow.repos["LlmCallRepository"].add.call_args.kwargs["credits_charged"] == 0

    async def test_no_center_id_no_deduction(self, facade, uow):
        p1, p2, _, deduct_svc = _patches()
        with p1, p2:
            await facade.add_llm_call(
                input_tokens=100,
                output_tokens=100,
                purpose=AIPurpose.SKILL_SELECTION,
                center_id=None,
            )

        deduct_svc.execute.assert_not_called()

    async def test_deduction_failure_does_not_block_record(self, facade, uow):
        p1, p2, _, deduct_svc = _patches()
        deduct_svc.execute.side_effect = RuntimeError("balance gone")
        with p1, p2:
            await facade.add_llm_call(
                input_tokens=100,
                output_tokens=100,
                purpose=AIPurpose.SKILL_SELECTION,
                center_id="center-1",
            )

        assert uow.repos["LlmCallRepository"].add.called
        assert uow.repos["LlmCallRepository"].add.call_args.kwargs["credits_charged"] == 0
