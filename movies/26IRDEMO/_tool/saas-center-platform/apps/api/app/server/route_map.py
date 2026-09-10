from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

_MODULES = "app.modules."
_EMPTY = compile("", "<empty>", "exec")
_AUTH = {
    "RequireAuthentication": "staff",
    "RequireAdminAuth": "admin",
    "RequireAppAuthentication": "app",
}


def _module_of(endpoint: Any) -> str:
    name = getattr(endpoint, "__module__", "")
    if name.startswith(_MODULES):
        return name[len(_MODULES) :].split(".")[0]
    if name.startswith("app."):
        return name.split(".")[1]
    return "(external)"


def _requires_of(route: APIRoute) -> list[Any]:
    """behavior.request(*requires)가 만든 의존성의 클로저에서 게이트를 꺼낸다.

    OpenAPI에는 게이트가 담기지 않아 라우트 객체를 직접 읽는 수밖에 없다.
    behavior/server.py의 `requires` 자유변수 이름에 묶여 있다 — build()가 개수로 감시한다.
    """
    for dep in route.dependant.dependencies:
        call = dep.call
        code = getattr(call, "__code__", None)
        closure = getattr(call, "__closure__", None)
        if code is None or closure is None:
            continue
        for name, cell in zip(code.co_freevars, closure):
            if name == "requires":
                return list(cell.cell_contents)
    return []


def _gates(actions: list[Any]) -> dict:
    gates: dict[str, Any] = {
        "auth": "none",
        "center": False,
        "permissions": [],
        "roles": [],
        "feature": None,
    }
    for action in actions:
        name = type(action).__name__
        if name in _AUTH:
            gates["auth"] = _AUTH[name]
        elif name == "RequireCenter":
            gates["center"] = True
        elif name == "RequirePermission":
            gates["permissions"] = list(action.codes)
        elif name == "RequireAdminRole":
            gates["roles"] = list(action.roles)
        elif name == "RequireFeature":
            gates["feature"] = action.feature
    return gates


def _type_of(schema: dict) -> str:
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if "anyOf" in schema:
        return " | ".join(_type_of(s) for s in schema["anyOf"])
    if "enum" in schema:
        return " | ".join(repr(v) for v in schema["enum"])
    if schema.get("type") == "array":
        return f"{_type_of(schema.get('items', {}))}[]"
    return schema.get("type", "any")


def _params(operation: dict) -> list[dict]:
    return [
        {
            "in": p["in"],
            "name": p["name"],
            "required": bool(p.get("required")),
            "type": _type_of(p.get("schema", {})),
            "default": p.get("schema", {}).get("default"),
            "description": p.get("description", ""),
        }
        for p in operation.get("parameters", [])
    ]


def _body(operation: dict) -> dict | None:
    content = (operation.get("requestBody") or {}).get("content") or {}
    if not content:
        return None
    media, spec = next(iter(content.items()))
    return {
        "media": media,
        "required": bool(operation["requestBody"].get("required")),
        "schema": spec.get("schema", {}),
    }


def _refs(
    node: Any,
    out: set[str],
) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            out.add(ref.rsplit("/", 1)[-1])
        for value in node.values():
            _refs(value, out)
    elif isinstance(node, list):
        for value in node:
            _refs(value, out)


def build(app: FastAPI) -> dict:
    spec = app.openapi()
    paths = spec.get("paths", {})
    all_schemas = spec.get("components", {}).get("schemas", {})

    modules: dict[str, list[dict]] = {}
    used: set[str] = set()
    with_gates = 0

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        requires = _requires_of(route)
        if requires:
            with_gates += 1
        gates = _gates(requires)

        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            operation = paths.get(route.path, {}).get(method.lower(), {})
            body = _body(operation)
            if body:
                _refs(body["schema"], used)
            modules.setdefault(_module_of(route.endpoint), []).append(
                {
                    "method": method,
                    "path": route.path,
                    "summary": operation.get("summary", ""),
                    "tags": list(route.tags),
                    "params": _params(operation),
                    "body": body,
                    "gates": gates,
                }
            )

    # body가 참조하는 것만 — 전 818개를 실으면 응답이 스펙만큼 커진다
    resolved: dict[str, dict] = {}
    pending = list(used)
    while pending:
        name = pending.pop()
        if name in resolved or name not in all_schemas:
            continue
        resolved[name] = all_schemas[name]
        nested: set[str] = set()
        _refs(all_schemas[name], nested)
        pending.extend(nested - resolved.keys())

    if not with_gates:
        raise RuntimeError(
            "게이트를 하나도 못 읽었다 — behavior.request의 `requires` 자유변수가 사라졌거나 이름이 바뀌었다"
        )

    for endpoints in modules.values():
        endpoints.sort(key=lambda e: (e["path"], e["method"]))

    return {
        "modules": [
            {"name": name, "endpoints": endpoints}
            for name, endpoints in sorted(modules.items(), key=lambda kv: -len(kv[1]))
        ],
        "schemas": resolved,
        "diagnostics": {"routes_with_gates": with_gates},
    }
