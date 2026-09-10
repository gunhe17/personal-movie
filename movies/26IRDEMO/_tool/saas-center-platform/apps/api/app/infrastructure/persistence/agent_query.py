"""agent query 표면 환산기 — repo 경계의 어휘 번역(offset_page와 같은 결).

소비자는 모듈 facade(v2 쿼리). 어휘 계약은 naming.md(정렬·필터 유도)·agent-query.md(봉투·투영)가
소유하고 여기는 배선만. 크로스모듈 표시명 조립은 각 query handler 본문 인라인 소관.
"""

from datetime import date, datetime, time
from typing import Any, Callable

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

# #
# limit — 행 절삭 상한 (봉투 exact 판정의 기준)

DEFAULT_LIMIT = 20
MAX_LIMIT = 40


def normalize_limit(
    limit: int | None,
    default: int = DEFAULT_LIMIT,
) -> int:
    """None/0/음수 → default, MAX_LIMIT 초과 → cap."""
    if not limit or limit <= 0:
        return default
    return min(limit, MAX_LIMIT)


# #
# sort — 표면 어휘(latest·{noun}_high…) → (order_by 컬럼, descending) 1회 전이

_TIME_COL = "created_at"


def resolve_sort(
    sort: str | None,
    *,
    columns: frozenset[str] = frozenset(),
    event_columns: dict[str, str] | None = None,
    time_col: str = _TIME_COL,
    default_col: str = _TIME_COL,
    default_desc: bool = True,
) -> tuple[str, bool]:
    # order_by는 신뢰된 컬럼만(persistence-repository.md §4 외부입력 직결 금지) — 화이트리스트 밖은 기본값
    # time_col = 대표 시간축(naming.md) — 엔티티별 지정(schedule=start 등), 기본 created_at
    # columns = 수치 {noun}_high/_low 화이트리스트 · event_columns = 사건축 {event}_earliest/_latest
    # {표면 event명: 실제 컬럼}(예: {"issued": "issued_at", "valid_until": "valid_until"})
    if not sort:
        return default_col, default_desc
    if sort == "latest":
        return time_col, True
    if sort == "oldest":
        return time_col, False
    for suffix, descending in (("_high", True), ("_low", False)):
        if sort.endswith(suffix):
            col = sort[: -len(suffix)]
            return (col, descending) if col in columns else (default_col, default_desc)
    # 사건축 — earliest=이른순(asc), latest=늦은순(desc). 대표축 무표 latest는 위에서 이미 처리
    events = event_columns or {}
    for suffix, descending in (("_earliest", False), ("_latest", True)):
        if sort.endswith(suffix):
            ev = sort[: -len(suffix)]
            return (events[ev], descending) if ev in events else (default_col, default_desc)
    return default_col, default_desc


# #
# projection — 필드 병합·행 직렬화 (자기 모듈 필드의 절삭·직렬화만)


def merge_fields(
    fields: list[str] | None,
    default: list[str],
    available: set[str],
    *,
    identity: list[str] | None = None,
) -> list[str]:
    """fields 미지정=default, 지정=identity+요청분(available 검증)."""
    if not fields:
        return list(default)
    base = list(identity) if identity else list(default)
    seen = set(base)
    for f in fields:
        if f in available and f not in seen:
            base.append(f)
            seen.add(f)
    return base


def to_dicts(
    entities: list,
    fields: list[str],
    namespace: str,
    *,
    resolvers: dict[str, Callable[[Any], Any]] | None = None,
) -> list[dict]:
    resolvers = resolvers or {}

    results: list[dict] = []
    for entity in entities:
        row: dict = {}
        for field in fields:
            key = f"{namespace}.{field}" if namespace else field
            if field in resolvers:
                row[key] = resolvers[field](entity)
                continue
            value = getattr(entity, field, None)
            if isinstance(value, (datetime, date, time)):
                value = value.isoformat()
            row[key] = value
        results.append(row)
    return results


# #
# group_by — G-impl 패턴 A (list→bucket). agent-query.md. handler 커스텀(B)은 직접 반환.


def _resolve_row_dim_value(row: dict, dim: str) -> Any:
    """namespaced 행(`case.status`)·bare 키에서 dim 값 해소."""
    if dim in row:
        return row[dim]
    suffix = "." + dim
    for k, v in row.items():
        if k.endswith(suffix) or k == dim:
            return v
    return None


def _dim_name_key(dim: str) -> str:
    if dim.endswith("_id"):
        return dim.removesuffix("_id") + "_name"
    return dim + "_name"


def _row_dim_label(row: dict, dim: str) -> Any:
    """버킷 표시명 — 행에 동반된 *_name / *_names 우선."""
    candidates = [_dim_name_key(dim)]
    if dim.endswith("_id"):
        candidates.append(dim.removesuffix("_id") + "_names")
    for cand in candidates:
        if cand in row:
            return row[cand]
        suffix = "." + cand
        for k, v in row.items():
            if k.endswith(suffix):
                return v
    return None


def group_list_rows(
    rows: list[dict],
    total: int | None,
    dim: str,
    *,
    allowed: frozenset[str],
) -> dict:
    """list 결과 → group 봉투 (nonempty). 절삭 시 exact=false."""
    if dim not in allowed:
        raise ValueError(f"unsupported group_by: {dim}")

    from collections import Counter

    counts: Counter[str] = Counter()
    labels: dict[str, Any] = {}
    raw_keys: dict[str, Any] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = _resolve_row_dim_value(row, dim)
        sk = "__missing__" if key is None else str(key)
        counts[sk] += 1
        raw_keys.setdefault(sk, key)
        if sk not in labels:
            lab = _row_dim_label(row, dim)
            if lab is not None:
                labels[sk] = lab

    name_key = _dim_name_key(dim)
    grouped: list[dict] = []
    for sk, cnt in counts.most_common():
        item: dict[str, Any] = {
            dim: None if sk == "__missing__" else raw_keys.get(sk, sk),
            "count": cnt,
        }
        if sk in labels:
            item[name_key] = labels[sk]
        grouped.append(item)

    n_rows = len(rows)
    agg_total = total if total is not None else n_rows
    # total이 DB 전체이고 행이 절삭되면 버킷 합 < total → exact false
    exact = agg_total <= n_rows
    return {
        "rows": grouped,
        "aggregate": {
            "count": agg_total,
            "exact": exact,
            "group_by": dim,
        },
    }


# #
# fetch — agent 조회 SQL 슬라이스 실행기 (app/query/**, ARCHITECTURE.md EX-11)

async def fetch(
    session: AsyncSession,
    stmt: Select,
    *,
    namespace: str | None,
    identity: tuple[str, ...],
    fields: list[str] | None = None,
    opt_in: tuple[str, ...] = (),
    limit: int | None = None,
) -> tuple[list[dict], int]:
    """agent 표면 행(JSON 안전 dict)과 총수.

    총수는 같은 stmt의 서브쿼리라 행 절삭과 무관하게 정확하다(exact 항상 참).
    **출력 필드 구성은 호출부의 `select()` 가 소유한다** — select 라벨 = 요청 가능한 전부,
    그중 opt_in을 뺀 것이 기본 투영. 여기서는 그 규칙만 집행한다.
    행 키 = `{namespace}.{select 라벨}`(namespace=None이면 맨 키, 비-agent 소비자용).
    """
    prefix = f"{namespace}." if namespace else ""
    rows = (await session.execute(stmt.limit(normalize_limit(limit)))).mappings().all()
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))

    available = rows[0].keys() if rows else ()
    keep = {*identity, *fields} if fields else {key for key in available if key not in opt_in}
    return [
        {
            f"{prefix}{key}": _plain(value)
            for key, value in row.items()
            if key in keep
        }
        for row in rows
    ], total or 0


def _plain(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


def demo() -> None:
    assert resolve_sort(None, default_col="name", default_desc=False) == ("name", False)
    assert resolve_sort("latest") == ("created_at", True)
    assert resolve_sort("oldest") == ("created_at", False)
    assert resolve_sort("price_high", columns=frozenset({"price"})) == ("price", True)
    assert resolve_sort("unit_price_low", columns=frozenset({"unit_price"})) == ("unit_price", False)
    assert resolve_sort("price_high") == ("created_at", True)  # 화이트리스트 밖 = 기본
    assert normalize_limit(None) == DEFAULT_LIMIT
    assert normalize_limit(999) == MAX_LIMIT
    assert merge_fields(["b", "x"], ["a"], {"a", "b"}, identity=["a"]) == ["a", "b"]
    print("ok")


if __name__ == "__main__":
    demo()
