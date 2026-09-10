"""payment_records 테이블 묘비(legacy).

결제 시스템이 billables + payments(신)로 컷오버됨(2026-07). 이 모델은 과거 행 보존
+ 테이블 등록(server/lifecycle.py)만을 위해 남긴다 — 읽기/쓰기 코드 없음.
백필 마이그 2ff3f0b278ce 가 payment_records → billables/billable_items/payments 로
분해했고, 원본 테이블은 롤백 안전망으로 보존한다.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class PaymentRecord(BaseModel):
    __tablename__ = "payment_records"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    client_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    related_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    billing_code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    completed_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
