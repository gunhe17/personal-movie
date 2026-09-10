"""_prefill 이벤트 계약 — 값0이어도 폼 인터페이스가 있으면 set_fields 동반(편집 상태 진입 트리거).
센터정보 view 잔류 사례(2026-07-27)의 회귀 가드.
choices 반환 = 서버가 대상을 하나로 못 좁힘 → 화면 대신 is_error 피드백(2026-08-11)."""

from app.runtime.assistant.catalog import ToolSpec
from app.runtime.assistant.execute import AssistantContext, _prefill
from app.runtime.assistant.llm import ToolCall


def _ctx() -> AssistantContext:
    return AssistantContext(
        center_id="c1",
        member_id="m1",
        account_id=None,
        permissions=(),
        owner_scope=None,
        uow=None,
    )


def _spec(
    properties: dict,
    handler=None,
) -> ToolSpec:
    return ToolSpec(
        name="prefill_x_handler",
        description="",
        kind="prefill",
        input_schema={"type": "object", "properties": properties, "required": []},
        handler=handler or (lambda **f: {"page_path": "/x", "fields": f}),
    )


async def test_prefill_emits_set_fields_even_without_values():
    out = await _prefill(
        _spec({"centerName": {"type": "string"}}),
        ToolCall(id="t1", name="prefill_x_handler", args={}),
        _ctx(),
    )
    assert [e["tool"] for e in out.events] == ["page.navigate", "page.set_fields"]
    assert out.events[1]["args"] == {"fields": {}}


async def test_prefill_navigate_only_for_fieldless_tool():
    out = await _prefill(
        _spec({}), ToolCall(id="t1", name="prefill_x_handler", args={}), _ctx()
    )
    assert [e["tool"] for e in out.events] == ["page.navigate"]


async def test_prefill_awaits_async_handler_and_injects_uow():
    """읽기 허용(2026-08-11) — 시그니처에 uow가 있으면 주입되고 코루틴이면 await."""
    seen: dict = {}

    async def handler(
        *,
        center_id: str,
        uow,
        **f,
    ):
        seen.update(center_id=center_id, uow_injected="uow" in dir(uow) or uow is None)
        return {"page_path": "/x", "fields": f}

    out = await _prefill(
        _spec({}, handler), ToolCall(id="t1", name="prefill_x_handler", args={}), _ctx()
    )
    assert seen["center_id"] == "c1"
    assert [e["tool"] for e in out.events] == ["page.navigate"]


async def test_prefill_error_returns_fact_instead_of_opening_screen():
    """화면을 못 열면 빈 화면 대신 사실 피드백 — 거짓 "열었습니다" 방지(R6)."""
    err = {"reason": "후보 다수", "choices": [{"session_number": 4}, {"session_number": 3}]}
    out = await _prefill(
        _spec({}, lambda **f: {"error": err}),
        ToolCall(id="t1", name="prefill_x_handler", args={}),
        _ctx(),
    )
    assert out.ret.is_error is True
    assert len(out.ret.content["choices"]) == 2
    # 거절도 기록에 남는다(히스토리 흔적) — 단 화면엔 안 그린다
    assert [(e["tool"], e["display"], e["is_error"]) for e in out.events] == [
        ("prefill_x_handler", "none", True)
    ]
