from datetime import date

from sqlalchemy import Date, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Voucher(BaseModel):
    __tablename__ = "vouchers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    program_name: Mapped[str] = mapped_column(String(255), nullable=False)
    program_organization: Mapped[str] = mapped_column(String(255), nullable=False)
    program_year: Mapped[int] = mapped_column(Integer, nullable=False)
    usage_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    usage_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    application_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    application_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    application_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_target: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 자격 룰(자가진단 매칭용): {"min_age", "max_age", "income_max_pct", "need_evidence"} — null=기준 미정
    eligibility: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # 추출 정규화 레코드(§1~§10, 바우처-정규화-토의.md) — confirm 시 무손실 보존. null=수동 생성
    record: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    support_amount: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_vouchers_program_year", "program_year"),
        Index("ix_vouchers_program_organization", "program_organization"),
        Index("ix_vouchers_deleted_at", "deleted_at"),
    )
