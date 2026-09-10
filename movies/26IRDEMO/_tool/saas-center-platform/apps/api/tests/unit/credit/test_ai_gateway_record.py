"""AIGateway._record_call 크레딧 차감 통합 테스트.

실제 DB 세션 없이 mock으로 _record_call의 흐름을 검증한다.
- 유료 purpose: LlmCall 생성 + CreditBalance 차감
- 무료 purpose: LlmCall 생성, 차감 없음 (credits_charged=0)
- 미등록 purpose: 기록 거부
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from contextlib import asynccontextmanager

from app.modules.llm.gateway.ai_gateway import AIGateway
from app.modules.llm.gateway.schemas import AICallContext, redact_image_messages
from app.modules.llm.credit_balance.plan_config import AIPurpose, FREE_PURPOSES


class FakeSession:
    """DB 세션 mock — add/commit/rollback 지원."""

    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def execute(self, stmt):
        return MagicMock()


@asynccontextmanager
async def fake_session_factory():
    yield FakeSession()


class TestRecordCall:
    """_record_call이 LlmCall + 크레딧을 올바르게 처리하는지 검증."""

    async def test_paid_purpose_creates_llm_call_and_deducts(self):
        """유료 purpose → LlmCall 생성 + 크레딧 차감."""
        gateway = AIGateway(fake_session_factory)
        ctx = AICallContext(
            center_id="center-1",
            source_type="field_note",
            source_id="fn-1",
            purpose=AIPurpose.FIELD_NOTE_SUMMARIZE,
            member_id="member-1",
        )

        with patch(
            "app.modules.llm.credit_rate_config.repository.CreditRateConfigRepository"
        ) as MockRateRepo, patch(
            "app.modules.llm.credit_balance.repository.CreditBalanceRepository"
        ) as MockBalanceRepo, patch(
            "app.modules.llm.credit_balance.services.DeductCreditService"
        ) as MockDeductSvc:
            # rate config mock
            rate_instance = AsyncMock()
            rate_instance.find_active.return_value = None
            MockRateRepo.return_value = rate_instance

            # deduct mock — (atomic, rate, credits)
            deduct_instance = AsyncMock()
            deduct_instance.execute.return_value = (None, 2000, 2)
            MockDeductSvc.return_value = deduct_instance

            await gateway._record_call(
                ctx,
                model="gpt-4o",
                input_tokens=1500,
                output_tokens=500,
                latency_ms=250.0,
            )

            # DeductCreditService가 호출되어야 함 (유료)
            deduct_instance.execute.assert_called_once_with(
                "center-1", 2000, rate=2000,  # 1500 + 500 = 2000 tokens
            )

    async def test_free_purpose_no_deduction(self):
        """무료 purpose → LlmCall 생성, 차감 안 함."""
        gateway = AIGateway(fake_session_factory)
        ctx = AICallContext(
            center_id="center-1",
            source_type="field_note",
            source_id="fn-1",
            purpose=AIPurpose.FIELD_NOTE_STT_CHUNK,
        )

        with patch(
            "app.modules.llm.credit_rate_config.repository.CreditRateConfigRepository"
        ) as MockRateRepo, patch(
            "app.modules.llm.credit_balance.services.DeductCreditService"
        ) as MockDeductSvc:
            rate_instance = AsyncMock()
            rate_instance.find_active.return_value = None
            MockRateRepo.return_value = rate_instance

            deduct_instance = AsyncMock()
            MockDeductSvc.return_value = deduct_instance

            await gateway._record_call(
                ctx,
                model="whisper-1",
                input_tokens=0,
                output_tokens=0,
                audio_duration_seconds=30.0,
            )

            # 무료 purpose이므로 DeductCreditService 호출 안 됨
            deduct_instance.execute.assert_not_called()

    async def test_unregistered_purpose_blocked(self):
        """미등록 purpose → 기록 거부 (session에 add 안 됨)."""
        sessions_created = []

        @asynccontextmanager
        async def tracking_factory():
            session = FakeSession()
            sessions_created.append(session)
            yield session

        gateway = AIGateway(tracking_factory)
        ctx = AICallContext(
            center_id="center-1",
            source_type="test",
            purpose="unknown_purpose_xyz",
        )

        await gateway._record_call(
            ctx,
            model="gpt-4o",
            input_tokens=100,
            output_tokens=50,
        )

        # 세션이 생성되지 않아야 함 (return 전에 exit)
        assert len(sessions_created) == 0

    async def test_run_experiment_no_bill_and_provider_dispatch(self):
        """run_experiment은 과금하지 않고(=_record_call 미호출) provider로 클라이언트를 고른다."""
        gateway = AIGateway(fake_session_factory)
        gateway._record_call = AsyncMock()  # 과금 경로 감시

        fake_result = MagicMock(content="labeled", input_tokens=10, output_tokens=5, latency_ms=1.0)
        openai_c = MagicMock()
        openai_c.quick = AsyncMock(return_value=fake_result)
        openrouter_c = MagicMock()
        openrouter_c.quick = AsyncMock(return_value=fake_result)

        with patch("app.infrastructure.llm.factory.openai_client", return_value=openai_c) as mk_openai, \
             patch("app.infrastructure.llm.factory.openrouter_client", return_value=openrouter_c) as mk_openrouter:
            r = await gateway.run_experiment(
                provider="openrouter", model="m1",
                system_prompt="s", user_prompt="u", max_tokens=100,
            )
            assert r is fake_result
            mk_openrouter.assert_called_once_with("m1")
            mk_openai.assert_not_called()

            await gateway.run_experiment(
                provider="openai", model="m2",
                system_prompt="s", user_prompt="u",
            )
            mk_openai.assert_called_once_with("m2")

        # 실험은 과금하지 않는다
        gateway._record_call.assert_not_called()

    async def test_no_center_id_no_deduction(self):
        """center_id 없으면 크레딧 차감 안 함 (LlmCall은 생성)."""
        gateway = AIGateway(fake_session_factory)
        ctx = AICallContext(
            center_id="",  # 빈 문자열
            source_type="test",
            purpose=AIPurpose.SKILL_SELECTION,
        )

        with patch(
            "app.modules.llm.credit_rate_config.repository.CreditRateConfigRepository"
        ) as MockRateRepo, patch(
            "app.modules.llm.credit_balance.services.DeductCreditService"
        ) as MockDeductSvc:
            rate_instance = AsyncMock()
            rate_instance.find_active.return_value = None
            MockRateRepo.return_value = rate_instance

            deduct_instance = AsyncMock()
            MockDeductSvc.return_value = deduct_instance

            await gateway._record_call(
                ctx,
                model="gpt-4o",
                input_tokens=500,
                output_tokens=200,
            )

            # center_id가 falsy이므로 차감 안 됨
            deduct_instance.execute.assert_not_called()

class TestRedactImageMessages:
    def test_text_only_passthrough(self):
        messages = [{"role": "system", "content": "sys"}]
        assert redact_image_messages(messages) == messages

    def test_image_url_omitted_by_size_not_content(self):
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": "hello"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + "a" * 100}},
            ],
        }]

        redacted = redact_image_messages(messages)

        assert redacted[0]["content"][0] == {"type": "text", "text": "hello"}
        image_block = redacted[0]["content"][1]
        assert image_block["type"] == "image_url"
        assert "url" not in image_block["image_url"]
        assert image_block["image_url"]["omitted_bytes"] > 100
