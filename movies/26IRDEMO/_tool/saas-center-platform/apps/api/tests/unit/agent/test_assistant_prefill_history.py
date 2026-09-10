"""prefill 흔적 히스토리 복원 — 텍스트-only prefill 턴이 다음 턴 자발 포기를 유발하는
오염의 수리(페어드 실측 완주 11%→67%, labs/agent_loop/prefill_history_lab.py)."""

import json

from app.runtime.assistant.engine import _history_items


class _Turn:
    id = "abcdef12-0000-0000-0000-000000000000"
    user_message = "일정 등록해줘"
    completion = "상담 일정 등록 화면이 열렸습니다."
    events = [
        {"type": "step_tool_call", "tool": "page.navigate",
         "args": {"path": "/counseling/receive"},
         "origin": "prefill_counseling_receive_handler",
         "origin_args": {"client_id": "c-1", "date": "2026-07-28"}},
        {"type": "step_tool_call", "tool": "page.set_fields", "args": {"fields": {}}},
    ]


def test_prefill_turn_restores_tool_trace():
    items = _history_items([_Turn()])
    tool_uses = [b for m in items if isinstance(m["content"], list)
                 for b in m["content"] if b["type"] == "tool_use"]
    assert tool_uses and tool_uses[0]["name"] == "prefill_counseling_receive_handler"
    # 인자 충실 복원 — input={} 복원은 "빈 인자 prefill" 모방을 가르침(WUI 실측)
    assert tool_uses[0]["input"] == {"client_id": "c-1", "date": "2026-07-28"}
    results = [b for m in items if isinstance(m["content"], list)
               for b in m["content"] if b["type"] == "tool_result"]
    assert json.loads(results[0]["content"])["navigated"] == "/counseling/receive"
    assert items[-1]["content"] == "상담 일정 등록 화면이 열렸습니다."


def test_legacy_events_without_origin_stay_text_only():
    class _Legacy(_Turn):
        events = [{"type": "step_tool_call", "tool": "page.navigate",
                   "args": {"path": "/x"}}]

    items = _history_items([_Legacy()])
    assert all(isinstance(m["content"], str) for m in items)
