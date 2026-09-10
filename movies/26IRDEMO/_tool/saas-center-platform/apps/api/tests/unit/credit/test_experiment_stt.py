"""AIGateway experiment STT — no-bill 계약(기록·차감 없음) + 파라미터 pass-through."""
from unittest.mock import AsyncMock, MagicMock, patch

from app.modules.llm.gateway.ai_gateway import AIGateway


def make_gateway():
    gateway = AIGateway(lambda: None)
    gateway._record_call = AsyncMock()
    gateway.verify_quota = AsyncMock()
    return gateway


async def test_experiment_transcribe_no_bill_no_quota():
    gateway = make_gateway()
    client = MagicMock()
    client.transcribe = AsyncMock(return_value="텍스트")

    with patch(
        "app.infrastructure.stt.whisper.client.WhisperSTTClient", return_value=client
    ) as MockClient:
        text = await gateway.experiment_transcribe(
            b"audio", model="whisper-1", language="ko", filename="a.webm",
        )

    assert text == "텍스트"
    assert MockClient.call_args.kwargs["model"] == "whisper-1"
    client.transcribe.assert_awaited_once_with(
        audio_data=b"audio", language="ko", filename="a.webm",
    )
    gateway._record_call.assert_not_awaited()
    gateway.verify_quota.assert_not_awaited()


async def test_experiment_diarization_passes_kwargs():
    gateway = make_gateway()
    client = MagicMock()
    client.transcribe_with_diarization = AsyncMock(return_value={"text": "", "segments": []})

    with patch(
        "app.infrastructure.stt.whisper.client.WhisperSTTClient", return_value=client
    ):
        await gateway.experiment_transcribe_with_diarization(
            b"audio", model="gpt-4o-transcribe-diarize",
            model_override="gpt-4o-transcribe-diarize", known_duration=12.0,
        )

    kwargs = client.transcribe_with_diarization.await_args.kwargs
    assert kwargs["model_override"] == "gpt-4o-transcribe-diarize"
    assert kwargs["known_duration"] == 12.0
    gateway._record_call.assert_not_awaited()
