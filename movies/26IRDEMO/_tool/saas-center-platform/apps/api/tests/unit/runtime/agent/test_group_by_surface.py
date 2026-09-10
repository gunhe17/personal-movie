"""group_by 표면 — dims 표 · list→bucket · catalog 주입."""

from app.infrastructure.persistence.agent_query import group_list_rows
from app.runtime.assistant.catalog import specs_for
from app.runtime.assistant.group_by_dims import GROUP_BY_DIMS


def test_group_list_rows_nonempty_and_exact():
    rows = [
        {"case.status": "active", "case.id": "1"},
        {"case.status": "active", "case.id": "2"},
        {"case.status": "completed", "case.id": "3"},
    ]
    out = group_list_rows(rows, total=3, dim="status", allowed=frozenset({"status"}))
    assert out["aggregate"] == {"count": 3, "exact": True, "group_by": "status"}
    assert out["rows"][0] == {"status": "active", "count": 2}
    assert {"status": "completed", "count": 1} in out["rows"]


def test_group_list_rows_truncated_exact_false():
    rows = [{"x.client_id": "A", "x.client_name": "甲"}]
    out = group_list_rows(
        rows, total=10, dim="client_id", allowed=frozenset({"client_id"})
    )
    assert out["aggregate"]["exact"] is False
    assert out["aggregate"]["count"] == 10
    assert out["rows"] == [
        {"client_id": "A", "count": 1, "client_name": "甲"},
    ]


def test_group_list_rows_rejects_unknown():
    try:
        group_list_rows([], 0, "nope", allowed=frozenset({"status"}))
        raise AssertionError("expected ValueError")
    except ValueError as e:
        assert "unsupported" in str(e)


def test_catalog_injects_group_by_on_eligible_queries():
    specs = {s.name: s for s in specs_for(())}
    # 적격
    case = specs["query_case_handler"]
    assert "group_by" in case.input_schema["properties"]
    assert "status" in case.input_schema["properties"]["group_by"]["enum"]
    assert "group_by" in (case.description or "") or "건수 모드" in (case.description or "")
    # 제외
    assert "query_credit_balance_handler" not in GROUP_BY_DIMS
    sub = specs.get("query_subscription_handler")
    if sub:
        assert "group_by" not in (sub.input_schema.get("properties") or {})


def test_e5_when_on_all_group_by_tools():
    """E5 refined: 진행 포함 전체 / 진행 중 / ~별 대립이 description에 있어야 함."""
    from app.runtime.assistant.group_by_dims import GROUP_BY_WHEN, GROUP_BY_WHEN_STATUS

    assert "진행 포함" in GROUP_BY_WHEN
    assert "group_by 금지" in GROUP_BY_WHEN
    assert "~별" in GROUP_BY_WHEN or "별로" in GROUP_BY_WHEN

    specs = {s.name: s for s in specs_for(())}
    for name, dims in GROUP_BY_DIMS.items():
        desc = specs[name].description or ""
        assert "진행 포함" in desc, name
        assert "건수 모드" in desc, name
        if "status" in dims:
            assert "status 축" in desc or "group_by=status" in desc, name
        # 구 weak when만 남지 않았는지
        assert "진행 포함" in desc


def test_all_group_by_dims_are_query_tools():
    assert all(k.startswith("query_") for k in GROUP_BY_DIMS)
    assert len(GROUP_BY_DIMS) >= 30
