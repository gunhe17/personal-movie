"""요청 컨텍스트 — 미들웨어와 핸들러 간 trace_id 전파."""
from contextvars import ContextVar


trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)


def get_trace_id() -> str | None:
    """현재 요청의 trace_id 반환 (없으면 None)"""
    return trace_id_var.get()


def set_trace_id(value: str | None) -> None:
    """현재 요청의 trace_id 설정 (미들웨어에서 호출)"""
    trace_id_var.set(value)
