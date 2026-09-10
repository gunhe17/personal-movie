import asyncio

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)

from app.core.logger import get_logger
from app.infrastructure.stt.common.exception import STTProviderError

logger = get_logger(__name__)

TRANSIENT_STT_ERRORS = (
    InternalServerError,
    RateLimitError,
    APITimeoutError,
    APIConnectionError,
)
MAX_ATTEMPTS = 4
RETRY_BASE_DELAY = 1.0


async def call_with_retry(make_request, *, label: str):
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return await make_request()
        except TRANSIENT_STT_ERRORS as e:
            last_exc = e
            if attempt >= MAX_ATTEMPTS:
                break
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            logger.warning(
                f"STT {label} transient error "
                f"(attempt {attempt}/{MAX_ATTEMPTS}): "
                f"{type(e).__name__}: {e}; retrying in {delay:.0f}s"
            )
            await asyncio.sleep(delay)
    logger.error(f"STT {label} failed after {MAX_ATTEMPTS} attempts: {last_exc}")
    raise STTProviderError(f"STT {label} failed after {MAX_ATTEMPTS} attempts: {last_exc}") from last_exc
