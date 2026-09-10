"""AIGateway.transcribe_stream / StreamingTranscription 계약.

- 개시: provider 부재 → RuntimeError · quota 게이트는 세션 생성 전에 실행
- 사용량: fed bytes → duration(sample_rate*2 bytes/sec), record_usage 멱등
- close()는 기록하지 않는다 (유령 세션 eviction 무과금 유지)
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.gateway.ai_gateway import AIGateway, StreamingTranscription
from app.modules.llm.gateway.schemas import AICallContext


def make_ctx():
    return AICallContext(
        center_id="center-1",
        source_type="field_note",
        source_id="fn-1",
        purpose=AIPurpose.FIELD_NOTE_STT_STREAMING,
        pipeline_step="stt_streaming",
        member_id="member-1",
    )


def make_wrapper(sample_rate=16000):
    gateway = AIGateway(lambda: None)
    gateway._record_call = AsyncMock()
    provider_session = MagicMock()
    provider_session.feed_audio = AsyncMock()
    provider_session.close = AsyncMock()
    wrapper = StreamingTranscription(
        gateway,
        make_ctx(),
        provider_session,
        sample_rate=sample_rate,
        model="aws-transcribe-streaming",
    )
    return wrapper, gateway, provider_session


async def test_transcribe_stream_prechecks_quota_before_session():
    gateway = AIGateway(lambda: None)
    gateway.verify_quota = AsyncMock()
    provider = MagicMock()
    provider.create_session = AsyncMock(return_value=MagicMock())

    with patch(
        "app.infrastructure.stt.factory.get_streaming_provider", return_value=provider
    ):
        wrapper = await gateway.transcribe_stream(make_ctx(), sample_rate=8000)

    gateway.verify_quota.assert_awaited_once_with(
        "center-1", AIPurpose.FIELD_NOTE_STT_STREAMING
    )
    provider.create_session.assert_awaited_once()
    assert provider.create_session.await_args.kwargs["sample_rate"] == 8000
    assert isinstance(wrapper, StreamingTranscription)


async def test_transcribe_stream_raises_without_provider():
    gateway = AIGateway(lambda: None)

    with patch(
        "app.infrastructure.stt.factory.get_streaming_provider", return_value=None
    ):
        with pytest.raises(RuntimeError):
            await gateway.transcribe_stream(make_ctx())


async def test_fed_bytes_convert_to_duration():
    wrapper, _, provider_session = make_wrapper(sample_rate=16000)

    await wrapper.feed_audio(b"\x00" * 32000)
    await wrapper.feed_audio(b"\x00" * 16000)

    assert provider_session.feed_audio.await_count == 2
    assert wrapper.duration_seconds == pytest.approx(1.5)


async def test_record_usage_is_idempotent():
    wrapper, gateway, _ = make_wrapper()
    await wrapper.feed_audio(b"\x00" * 64000)

    await wrapper.record_usage()
    await wrapper.record_usage()

    gateway._record_call.assert_awaited_once()
    kwargs = gateway._record_call.await_args.kwargs
    assert kwargs["model"] == "aws-transcribe-streaming"
    assert kwargs["audio_duration_seconds"] == pytest.approx(2.0)


async def test_close_does_not_record():
    wrapper, gateway, provider_session = make_wrapper()

    await wrapper.close()

    provider_session.close.assert_awaited_once()
    gateway._record_call.assert_not_awaited()
