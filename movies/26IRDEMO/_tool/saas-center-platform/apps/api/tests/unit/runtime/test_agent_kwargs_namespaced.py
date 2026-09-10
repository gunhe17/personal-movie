"""agent 실행기가 query_* handler에 namespaced를 어떻게 채우는지.

기본값이 없으면 실행기가 None을 넣어(주입 아님·모델 args 아님) 접두가 통째로 사라진다 —
agent의 중간 결과 조인(`p["participant.counseling_case_id"]`)이 조용히 깨지는 자리.
"""

import inspect
from types import SimpleNamespace

import pytest

from app.query.client import query_client_handler
from app.query.counseling_session import (
    query_counseling_session_handler,
)
from app.runtime.assistant.execute import _build_kwargs

HANDLERS = [query_client_handler, query_counseling_session_handler]


@pytest.mark.parametrize("handler", HANDLERS)
def test_namespaced_defaults_to_true(handler):
    assert inspect.signature(handler).parameters["namespaced"].default is True


@pytest.mark.parametrize("handler", HANDLERS)
def test_executor_does_not_null_out_namespaced(handler):
    ctx = SimpleNamespace(center_id="c1", owner_scope=None, uow=None, member_id="m1")

    kwargs = _build_kwargs(handler, ctx, {})

    assert kwargs.get("namespaced", True) is not None, "실행기가 None으로 덮었다 — 접두 소멸"
