# 1K 토큰당 USD. 키는 prefix 매칭 (gpt-4.1-nano-2025-04-14 → gpt-4.1-nano)
MODEL_COST_PER_1K: dict[str, dict[str, float]] = {
    "google/gemini-2.5-flash-lite": {"input": 0.0001, "output": 0.0004},
    "gpt-4.1": {"input": 0.002, "output": 0.008},
    "gpt-4.1-nano": {"input": 0.0001, "output": 0.0004},
    "gpt-4.1-mini": {"input": 0.0004, "output": 0.0016},
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "text-embedding-3-large": {"input": 0.00013, "output": 0.0},
}

# 분당 USD
STT_COST_PER_MINUTE: dict[str, float] = {
    "whisper-1": 0.006,
    "gpt-4o-transcribe": 0.006,
    "gpt-4o-transcribe-diarize": 0.006,
    "gpt-4o-mini-transcribe": 0.003,
}

_DEFAULT_COST = {"input": 0.0005, "output": 0.0015}  # 미등록 모델 fallback


def _find_rates(model: str) -> dict[str, float]:
    if not model:
        return _DEFAULT_COST
    if model in MODEL_COST_PER_1K:
        return MODEL_COST_PER_1K[model]
    for key, rates in MODEL_COST_PER_1K.items():
        if model.startswith(key):
            return rates
    return _DEFAULT_COST


def estimate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    rates = _find_rates(model or "")
    return input_tokens / 1000 * rates["input"] + output_tokens / 1000 * rates["output"]


def estimate_stt_cost(model: str | None, audio_duration_seconds: float | None) -> float:
    if not audio_duration_seconds or not model:
        return 0.0
    rate = STT_COST_PER_MINUTE.get(model, 0.006)
    return (audio_duration_seconds / 60) * rate
