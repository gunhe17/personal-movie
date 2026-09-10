"""SSE 직렬화 — wire framing은 프론트 계약(data 라인 + [DONE])."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, AsyncIterator

from app.core.logger import get_logger

logger = get_logger(__name__)


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


async def to_sse(
    events: AsyncIterator[dict[str, Any]],
    *,
    log_tag: str,
) -> AsyncIterator[str]:
    """예외는 in-band conversation_error, finally가 항상 [DONE]."""
    count = 0
    try:
        async for event in events:
            count += 1
            yield f"data: {json.dumps(event, ensure_ascii=False, default=_json_default)}\n\n"
    except Exception as exc:
        logger.error("%s ERROR after %d events", log_tag, count, exc_info=True)
        error_event = {"type": "conversation_error", "message": str(exc)}
        yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
    finally:
        yield "data: [DONE]\n\n"
