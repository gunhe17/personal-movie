from __future__ import annotations

import os
from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.logger import get_logger

if TYPE_CHECKING:
    from app.infrastructure.stt.common.base import STTProvider

logger = get_logger(__name__)


@lru_cache
def get_stt_client() -> "STTProvider | None":
    from app.infrastructure.stt.whisper.client import WhisperSTTClient

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("OPENAI_API_KEY not set, STT disabled")
        return None
    logger.info(
        f"STT client initialized: model={settings.STT_MODEL}, "
        f"diarize_model={settings.STT_DIARIZE_MODEL}"
    )
    return WhisperSTTClient(
        api_key=api_key, model=settings.STT_MODEL, diarize_model=settings.STT_DIARIZE_MODEL,
    )


@lru_cache
def get_streaming_provider() -> "STTProvider | None":
    from app.infrastructure.stt.aws.client import AWSTranscribeStreamingClient

    if settings.STT_STREAMING_PROVIDER != "aws_transcribe":
        return None
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        logger.warning(
            "STT_STREAMING_PROVIDER=aws_transcribe but AWS credentials missing. "
            "Falling back to whisper_chunk mode."
        )
        return None
    logger.info(
        f"Streaming STT provider initialized: aws_transcribe "
        f"(region={settings.AWS_REGION}, lang={settings.AWS_TRANSCRIBE_LANGUAGE_CODE})"
    )
    return AWSTranscribeStreamingClient(
        region=settings.AWS_REGION,
        access_key=settings.AWS_ACCESS_KEY_ID,
        secret_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def get_diarization_client() -> "STTProvider | None":
    from app.infrastructure.stt.pyannote.client import PyAnnoteDiarizationClient

    token = os.environ.get("HUGGINGFACE_TOKEN")
    if not token:
        logger.info("HUGGINGFACE_TOKEN not set, specialized diarization unavailable")
        return None
    return PyAnnoteDiarizationClient(hf_token=token)
