from __future__ import annotations

import types
from datetime import datetime
from functools import wraps
from typing import Any, Union, get_args, get_origin, get_type_hints

# @typecheck(isinstance 기반)이 그대로 동작하도록 plain alias로 둔다.
# NewType·`type X =`(PEP695)는 isinstance가 못 받으므로 금지(validate._checkable 언랩 필요).
uuid_str = str
utc_dt = datetime  # naive(tzinfo=None) — DB가 timezone=False, 값은 UTC 규약

# 부분 업데이트 sentinel — omit(미전달)과 None(NULL로 clear)을 구분한다.
unset: Any = object()


class DevelopError(Exception):
    # 개발 시점 계약 위반(kwarg 타입 불일치). 정상 경로에선 발생하지 않는다.
    pass


def _checkable(tp: Any):
    # isinstance에 넣을 수 있는 형태로 변환. 불가/무의미하면 None(검사 스킵).
    if tp is None or tp is Any:
        return None
    origin = get_origin(tp)
    if origin is None:
        return tp if isinstance(tp, type) else None
    if origin is Union or origin is types.UnionType:
        parts = tuple(c for a in get_args(tp) if (c := _checkable(a)) is not None)
        return parts or None
    return origin  # dict[str, Any] -> dict, list[str] -> list, tuple[...] -> tuple


def typecheck(func):
    hints: dict | None = None

    @wraps(func)
    def wrapper(*args, **kwargs):
        nonlocal hints
        if hints is None:
            hints = get_type_hints(func)
        for name, value in kwargs.items():
            # unset은 부분 업데이트 sentinel(omit) — 다운스트림이 `if v is not unset`로
            # 필터하므로 명시 전달돼도 타입검사 skip(repo update_in_place 등 정상 경로).
            if value is unset:
                continue
            expected = _checkable(hints.get(name))
            if expected is None:
                continue
            if not isinstance(value, expected):
                raise DevelopError(
                    f"{name}: {hints.get(name)} 필요 (실제: {type(value).__name__})"
                )
        return func(*args, **kwargs)

    return wrapper
