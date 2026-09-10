from __future__ import annotations

import importlib
import pathlib

_MODULES_DIR = pathlib.Path(__file__).parent
_IMPORT_ROOT = _MODULES_DIR.parent.parent  # apps/api — `app.modules.…` 점표기 기준

_SELF = pathlib.Path(__file__)

TABLE_MODULES: list[str] = [
    ".".join(path.relative_to(_IMPORT_ROOT).with_suffix("").parts)
    for filename in ("models.py", "model.py")
    for path in sorted(_MODULES_DIR.rglob(filename))
    if path != _SELF
]

for _name in TABLE_MODULES:
    importlib.import_module(_name)
