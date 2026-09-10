"""Facade 계층 정적 감사 — scripts/audit_query_filters.py ④⑤축 고정."""
import importlib.util
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts" / "audit_query_filters.py"
_spec = importlib.util.spec_from_file_location("audit_query_filters", _SCRIPTS)
_audit = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_audit)


def test_facade_boundary_gaps():
    assert _audit.facade_boundary_gaps() == 0


def test_facade_repo_delegation_gaps():
    assert _audit.facade_repo_delegation_gaps() == 0
