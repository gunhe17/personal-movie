"""_build_payload reasoning optional 핀."""

from app.infrastructure.llm.openrouter.multimodal import _build_payload


def test_payload_without_reasoning_omits_key():
    p = _build_payload("m", [], 100, 1.0, None, None)
    assert "reasoning" not in p
    assert p["stream"] is True


def test_payload_with_reasoning_includes_effort():
    p = _build_payload(
        "m", [], 100, 1.0, None, None, reasoning={"effort": "low"}
    )
    assert p["reasoning"] == {"effort": "low"}


def test_payload_stop_and_format_unchanged():
    p = _build_payload(
        "m",
        [{"role": "user", "content": "x"}],
        50,
        0.1,
        {"type": "json_object"},
        ["STOP"],
    )
    assert p["response_format"] == {"type": "json_object"}
    assert p["stop"] == ["STOP"]
    assert "reasoning" not in p
