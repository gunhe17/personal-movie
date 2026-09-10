"""admin_audit_logs 테이블 묘비(legacy).

운영자 감사의 정본은 event outbox(events×event_atomics) read-model(../repository.py) —
이 테이블은 read-only 아카이브로 DB에 존치(코드 바인딩 제거, 판정 2026-07-10 · 존치 재확인
2026-07-27). 과거 행 보존 + 테이블 등록(migrations/env.py·init-schema.py·lifecycle.py)만을
위해 남긴다 — 읽기/쓰기 코드 없음.
"""
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class AdminAuditLog(BaseModel):
    __tablename__ = "admin_audit_logs"

    admin_account_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    admin_email: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index("ix_admin_audit_logs_admin_created", "admin_account_id", "created_at"),
        Index("ix_admin_audit_logs_action_created", "action", "created_at"),
        Index("ix_admin_audit_logs_target", "target_type", "target_id", "created_at"),
    )
