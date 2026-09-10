"""handler의 TOOL dict를 두 채널로 가른다 — FIND(description)와 CALL(input_schema).

각 handler는 자기완결적 TOOL dict만 선언한다(파싱 없음). 이 로더가 도구를
불러오는 쪽에서 검색용 텍스트와 Anthropic tool 정의를 만들어 낸다.
"""

# LLM이 절대 채우지 않는 순수 인프라 인자 — input_schema에 노출되면 버그.
# center_id·person_id·actor_id 같은 정체성 인자는 제외한다 — 도구에 따라 '대상'이나
# '필터'(예: 특정 작업자가 한 활동만)일 수 있고, LLM-facing 여부는 각 handler의 parameters가 정한다.
INJECTED_ARGS = frozenset({
    "uow", "audit", "background_tasks", "current_admin",
    "event_group_id", "actor_membership_id",
    "owner_scope",
})

_REQUIRED_FIELDS = ("name", "purpose", "keywords", "boundaries", "output", "input_schema")


def to_search_text(tool: dict) -> str:
    """FIND 채널 — BM25/임베딩이 매칭하는 텍스트. 값 제약(enum 등)은 넣지 않는다."""
    props = tool["input_schema"]["properties"]
    params = ", ".join(p.get("title", name) for name, p in props.items())
    return (
        f"[핵심 목적]: {tool['purpose']}\n"
        f"[관련 키워드]: {', '.join(tool['keywords'])}\n"
        f"[차별점/주의]: {tool['boundaries']}\n"
        f"[입력]: {params}\n"
        f"[반환]: {tool['output']}"
    )


def _collect_defs(node, defs: dict) -> None:
    if isinstance(node, dict):
        if "$defs" in node:
            defs.update(node.pop("$defs"))
        for v in node.values():
            _collect_defs(v, defs)
    elif isinstance(node, list):
        for v in node:
            _collect_defs(v, defs)


def _hoist_defs(schema: dict) -> dict:
    """중첩된 모든 $defs를 루트로 끌어올린다.

    pydantic model_json_schema는 `$ref: "#/$defs/X"`를 쓰는데 $ref는 문서 루트 기준이라,
    프로퍼티·배열 items 안에 박힌 $defs는 그대로면 안 풀린다. 루트로 합쳐야 resolve된다.
    """
    from copy import deepcopy

    out = deepcopy(schema)
    defs: dict = {}
    _collect_defs(out, defs)
    if defs:
        out["$defs"] = defs
    return out


def to_anthropic_tool(tool: dict, *, defer_loading: bool = True) -> dict:
    """CALL 채널 — Anthropic API tools 배열 항목. description=FIND 텍스트, input_schema=권위."""
    result = {
        "name": tool["name"],
        "description": to_search_text(tool),
        "input_schema": _hoist_defs(tool["input_schema"]),
    }
    if defer_loading:
        result["defer_loading"] = True
    return result


def _valid_permission_codes() -> frozenset[str]:
    from app.core.permissions import Permission

    return frozenset(
        v for k, v in vars(Permission).items()
        if not k.startswith("_") and isinstance(v, str)
    )


def validate(tool: dict) -> None:
    """빌드 타임 가드 — 누락·injected 노출·required 불일치·권한 코드 오타를 조기에 잡는다."""
    for field in _REQUIRED_FIELDS:
        if not tool.get(field):
            raise ValueError(f"{tool.get('name', '?')}: '{field}' 누락")

    # permission: 키 필수, 값은 None(멤버십만) 또는 Permission 카탈로그 코드.
    if "permission" not in tool:
        raise ValueError(f"{tool['name']}: 'permission' 키 누락 (멤버십만이면 None 명시)")
    perm = tool["permission"]
    if perm is not None and perm not in _valid_permission_codes():
        raise ValueError(f"{tool['name']}: 알 수 없는 permission 코드 {perm!r}")

    if not isinstance(tool.get("agent_exposed", True), bool):
        raise ValueError(f"{tool['name']}: agent_exposed는 bool")

    props = tool["input_schema"].get("properties", {})
    leaked = INJECTED_ARGS & props.keys()
    if leaked:
        raise ValueError(f"{tool['name']}: injected 인자가 input_schema에 노출됨 {sorted(leaked)}")

    missing = set(tool["input_schema"].get("required", [])) - props.keys()
    if missing:
        raise ValueError(f"{tool['name']}: required가 properties에 없음 {sorted(missing)}")

    # 총체 쿼리 계약(naming.md 'query' 동사): query_* = 전 필드 optional 유연 조회.
    # 표시는 이름 접두가 정본이고 여기서 형태를 강제한다 — 역방향(산문만 유연 조회) 드리프트 포함.
    if tool["name"].startswith("query_"):
        if tool["input_schema"].get("required"):
            raise ValueError(f"{tool['name']}: 총체 쿼리는 전 필드 optional (required=[])")
        if "fields" not in props:
            raise ValueError(f"{tool['name']}: 총체 쿼리 표준 파라미터 'fields' 누락")
        if (perm or "").startswith(("write:", "delete:")):
            raise ValueError(f"{tool['name']}: 총체 쿼리는 read 표면 — write/delete 권한 불가")
    elif "유연 조회" in f"{tool.get('purpose', '')}{tool.get('boundaries', '')}":
        raise ValueError(f"{tool['name']}: '유연 조회' 선언인데 query_ 접두 아님 — 이름 정렬 필요")


def demo() -> None:
    tool = {
        "name": "update_widget_status_handler",
        "permission": "write:client",
        "purpose": "내담자의 상태를 전환한다.",
        "keywords": ["상태 변경", "비활성화", "졸업 처리"],
        "boundaries": "상태만 전환. 정보 수정은 update_widget_handler.",
        "output": "변경된 내담자 1건 (ClientResponse JSON).",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자"},
                "new_status": {"type": "string", "title": "전환할 상태",
                               "enum": ["active", "inactive", "archived"]},
            },
            "required": ["client_id", "new_status"],
        },
    }
    validate(tool)

    text = to_search_text(tool)
    assert "[핵심 목적]" in text and "졸업 처리" in text
    assert "enum" not in text  # 값 제약은 FIND 채널로 새지 않는다
    assert "대상 내담자, 전환할 상태" in text  # title로 파라미터 힌트

    api = to_anthropic_tool(tool)
    assert api["name"] == tool["name"]
    assert api["input_schema"]["properties"] == tool["input_schema"]["properties"]
    assert api["defer_loading"] is True

    leaked = dict(tool, input_schema={"properties": {"uow": {"type": "string"}}, "required": []})
    try:
        validate(leaked)
        raise AssertionError("injected 노출을 못 잡음")
    except ValueError as e:
        assert "uow" in str(e)

    # owner_scope도 injected — input_schema에 노출되면 잡는다
    scoped = dict(tool, input_schema={"properties": {"owner_scope": {"type": "string"}}, "required": []})
    try:
        validate(scoped)
        raise AssertionError("owner_scope 노출을 못 잡음")
    except ValueError as e:
        assert "owner_scope" in str(e)

    # permission 키 누락 / 오타 코드
    no_perm = {k: v for k, v in tool.items() if k != "permission"}
    try:
        validate(no_perm)
        raise AssertionError("permission 누락을 못 잡음")
    except ValueError as e:
        assert "permission" in str(e)

    try:
        validate(dict(tool, permission="read:bogus"))
        raise AssertionError("오타 permission 코드를 못 잡음")
    except ValueError as e:
        assert "bogus" in str(e)

    # permission=None(멤버십만) 은 통과
    validate(dict(tool, permission=None))

    # data 프로퍼티의 $defs가 루트로 hoist되어 $ref가 resolve되는지
    data_tool = dict(tool, input_schema={
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "title": "대상 내담자"},
            "data": {"type": "object", "title": "관계 정보",
                     "properties": {"kind": {"$ref": "#/$defs/Kind"}},
                     "$defs": {"Kind": {"enum": ["guardian", "sibling"]}}},
        },
        "required": ["client_id", "data"],
    })
    hoisted = to_anthropic_tool(data_tool)["input_schema"]
    assert hoisted["$defs"] == {"Kind": {"enum": ["guardian", "sibling"]}}  # 루트로 올라옴
    assert "$defs" not in hoisted["properties"]["data"]                     # 프로퍼티에선 제거

    print("ok")


if __name__ == "__main__":
    demo()
