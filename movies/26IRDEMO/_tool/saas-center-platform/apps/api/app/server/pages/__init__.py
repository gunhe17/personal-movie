"""서버 렌더링 페이지 — `system.py`의 `schema_map_router`가 그대로 내보내는 HTML."""

import pathlib

_HERE = pathlib.Path(__file__).parent

SCHEMA_CANVAS = _HERE / "schema-canvas.html"
