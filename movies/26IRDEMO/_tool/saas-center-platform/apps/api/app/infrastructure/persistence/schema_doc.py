"""등록된 모델 → 캔버스가 파싱하는 스키마 마크다운 + 도메인 색.

캔버스(`app/server/pages/schema-canvas.html`)는 `GET /schema-data`로 이걸 실시간 조회한다.
docs/schema.md 갱신:

    uv run python -m app.infrastructure.persistence.schema_doc
"""

import importlib
import pathlib

from sqlalchemy import inspect as sa_inspect

from app.infrastructure.persistence.models import BaseModel

SCHEMA_MD = pathlib.Path(__file__).resolve().parents[5] / "docs" / "schema.md"

# 도메인(=모듈) 색. 미등재 모듈은 순환 배정된다.
PALETTE = [
    "#c2410c", "#ef4444", "#c084fc", "#22c55e", "#2563eb", "#38bdf8",
    "#f59e0b", "#2dd4bf", "#a3e635", "#d946ef", "#f472b6", "#0ea5e9",
    "#84cc16", "#eab308", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1",
]


def import_all_models() -> None:
    import app.modules as M

    # app.modules 는 __init__.py 없는 namespace package라 __file__ 이 None — __path__ 가 유일한 경로
    root = pathlib.Path(M.__path__[0])
    for p in sorted(root.rglob("*model*.py")):
        if "__pycache__" in p.parts:
            continue
        mod = ".".join(p.relative_to(root.parent.parent).with_suffix("").parts)
        importlib.import_module(mod)


def registered_models() -> list:
    models = [m.class_ for m in BaseModel.registry.mappers if hasattr(m.class_, "__tablename__")]
    return list({m.__tablename__: m for m in models}.values())


def domain_of(model) -> str:
    # app.modules.<module>.<entity>.models → <module>
    parts = model.__module__.split(".")
    return "".join(w.capitalize() for w in parts[2].split("_"))


def infer_ref(
    name: str,
    known: set[str],
) -> str | None:
    """마커 없는 `*_id`를 이름으로 추정 (center_id → centers).

    ponytail: DB FK가 없어 마커가 유일한 선언이지만 center_id 등은 마커를 달지 않는다.
    복수형 후보가 실제 테이블일 때만 간선을 만든다 — 오탐이 나면 마커를 다는 게 정답.
    """
    if not name.endswith("_id"):
        return None
    stem = name[:-3]
    for cand in (stem + "s", stem[:-1] + "ies" if stem.endswith("y") else "", stem + "es"):
        if cand in known:
            return cand
    return None


def type_str(
    col,
    known: set[str],
) -> str:
    t = str(col.type).lower()
    ref = col.info.get("reference_table_name")
    poly = col.info.get("reference_tables")
    if poly:
        return f"{t} (다형참조 → {', '.join(sorted(set(poly.values())))})"
    ref = ref or infer_ref(col.name, known)
    return f"{t} (FK → {ref}.id)" if ref else t


def constraints(col) -> str:
    out = []
    if col.primary_key:
        out.append("PK")
    out.append("nullable" if col.nullable else "not null")
    if col.unique:
        out.append("unique")
    if col.index:
        out.append("index")
    if col.default is not None and getattr(col.default, "is_scalar", False):
        out.append(f"default={col.default.arg}")
    elif col.server_default is not None:
        out.append("server_default")
    return "@db/" + ", ".join(out)


def describe(
    col,
    known: set[str],
) -> str:
    if col.comment:
        return col.comment
    poly = col.info.get("reference_tables")
    if poly:
        return f"다형 대상 ({col.info.get('reference_type_field', '?')}로 판별)"
    ref = col.info.get("reference_table_name") or infer_ref(col.name, known)
    return f"{ref} 연결" if ref else "..."


def build_markdown(models: list) -> str:
    known = {m.__tablename__ for m in models}
    by_domain: dict[str, list] = {}
    for m in models:
        by_domain.setdefault(domain_of(m), []).append(m)

    out: list[str] = []
    for domain in sorted(by_domain):
        out.append(f"## {domain} 도메인\n")
        for model in sorted(by_domain[domain], key=lambda m: m.__tablename__):
            table = sa_inspect(model).local_table
            scope = "center" if "center_id" in table.c else "global"
            out.append("---\n")
            out.append(f"domain: {model.__tablename__}")
            out.append(f"scope: {scope}\n")
            for col in table.c:
                out.append(col.name)
                out.append(type_str(col, known))
                out.append(describe(col, known))
                out.append(constraints(col) + "\n")
    return "\n".join(out).rstrip() + "\n"


def build_domain_colors(models: list) -> dict[str, str]:
    domains = sorted({domain_of(m) for m in models})
    return {d: PALETTE[i % len(PALETTE)] for i, d in enumerate(domains)}


# 캔버스 Export 패널이 붙이는 것과 동일 — 붙여넣기 왕복 시 형태가 어긋나지 않게.
SCOPE_LEGEND = """
## Scope 범례

| scope | 설명 |
|-------|------|
| global | 센터 경계 없이 전역 관리 (center_id 없음) |
| center | 센터별 격리 (center_id 필수, RLS 적용) |
"""


def main() -> None:
    import_all_models()
    models = registered_models()
    SCHEMA_MD.write_text(build_markdown(models) + SCOPE_LEGEND)
    print(f"{len(models)} tables → {SCHEMA_MD}")


if __name__ == "__main__":
    main()
