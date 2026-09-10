from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Usage:
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass(frozen=True)
class ToolUse:
    id: str
    name: str
    input: dict


@dataclass(frozen=True)
class MessageResult:
    text: str
    stop_reason: str | None
    usage: Usage
    tool_uses: list[ToolUse]
    model: str
    # 원본 응답 블록 그대로. thinking 블록은 서명돼 있어 수정 시 API 가 거부하고 멀티턴
    # replay 가 깨진다 — 정규화하지 않고 불투명하게 보존해 다음 턴에 그대로 되돌린다.
    content: list[Any]
    latency_ms: float | None = None
