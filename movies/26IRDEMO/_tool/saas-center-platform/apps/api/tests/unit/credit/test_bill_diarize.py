"""AIGateway.bill_diarize — 길이→합성토큰 환산·차감 계약.

- 환산: ceil(duration/60 * DIARIZE_TOKENS_PER_MINUTE)을 input_tokens로 기록
- 0초(합성토큰 0)는 기록·차감 스킵
"""
import math
from unittest.mock import AsyncMock

from app.modules.llm.credit_balance.plan_config import (
    AIPurpose,
    DIARIZE_TOKENS_PER_MINUTE,
)
from app.modules.llm.gateway.ai_gateway import AIGateway
from app.modules.llm.gateway.schemas import AICallContext


def make_gateway():
    gateway = AIGateway(lambda: None)
    gateway._record_call = AsyncMock()
    return gateway


def make_ctx():
    return AICallContext(
        center_id="center-1",
        source_type="field_note",
        source_id="fn-1",
        purpose=AIPurpose.FIELD_NOTE_STT_DIARIZE,
        member_id="member-1",
    )


async def test_bill_diarize_records_synthetic_tokens():
    gateway = make_gateway()
    ctx = make_ctx()

    await gateway.bill_diarize(ctx, duration_seconds=90.0, model="stt-x")

    expected = math.ceil(90.0 / 60 * DIARIZE_TOKENS_PER_MINUTE)
    gateway._record_call.assert_awaited_once_with(
        ctx,
        model="stt-x",
        input_tokens=expected,
    )


async def test_bill_diarize_skips_zero_duration():
    gateway = make_gateway()

    await gateway.bill_diarize(make_ctx(), duration_seconds=0.0, model="stt-x")

    gateway._record_call.assert_not_awaited()
