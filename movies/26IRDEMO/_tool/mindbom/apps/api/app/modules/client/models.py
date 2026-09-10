"""내담자(피검자) 모델"""
from datetime import date
from sqlalchemy import Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Client(BaseModel):
    """내담자 (피검자)

    Attributes:
        institution_id: 기관 ID
        name: 이름
        birth_date: 생년월일
        gender: 성별 (male, female)
        phone: 전화번호
        email: 이메일
        education_level: 학력
        occupation: 직업
        referral_source: 의뢰 경로 (hospital, school, self, other)
        status: 상태 (active, inactive)
        note: 비고
    """

    __tablename__ = "clients"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    referral_source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
