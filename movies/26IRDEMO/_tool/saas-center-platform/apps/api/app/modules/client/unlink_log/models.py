"""client_unlink_logs 테이블 묘비(legacy).

배선된 적 없는 표면 — 쓰기·읽기 경로 0, 전 환경 0행(존치 판정 2026-07-27). 테이블 등록
(migrations/env.py·init-schema.py·lifecycle.py)만을 위해 남긴다. Client↔Person 연결 해제가
실제 구현되면 이 테이블이 아니라 event emit(`client_unlinked`)이 정본.
"""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class ClientUnlinkLog(BaseModel):
    __tablename__ = "client_unlink_logs"

    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "persons"})
    unlinked_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
