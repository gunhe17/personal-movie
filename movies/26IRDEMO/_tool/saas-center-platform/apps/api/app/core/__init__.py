"""Core 커널 — 순수 유틸/설정/타입.

지속성 커널(database/models/repository/unit_of_work)은 P2에서 app.infrastructure.persistence 로,
보안(해싱·JWT)은 app.infrastructure.hash / app.infrastructure.token 으로 이전됨 — 거기서 직접 import한다.
core는 더 이상 re-export하지 않는다(core→infra 역참조 금지).
"""
from app.core.config import settings

__all__ = ["settings"]
