from datetime import datetime

from app.application.handlers.activity.list_activity import _llm_to_response
from app.modules.llm.llm_call.schemas import LlmCallRecord


def test_llm_call_is_presented_as_event_activity():
    item = _llm_to_response(
        LlmCallRecord(
            id="call-1",
            center_id="center-1",
            source_type="agent",
            source_id="conversation-1",
            member_id="member-1",
            purpose="agent_chat",
            model="test-model",
            input_tokens=10,
            output_tokens=5,
            credits_charged=1,
            created_at=datetime(2026, 7, 15),
        ),
        center_id="center-1",
        actor_name="김상담",
    )

    assert item.event_name == "llm_call_recorded"
    assert item.entity_id == "conversation-1"
    assert item.changes[0].extra["credits_charged"] == 1
