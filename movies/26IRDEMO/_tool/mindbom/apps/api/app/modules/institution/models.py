"""기관 모델"""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Institution(BaseModel):
    """의료기관/상담기관

    Attributes:
        name: 기관명
        institution_type: 기관 유형 (hospital, clinic, counseling_center, research)
        address: 주소
        phone: 전화번호
        representative: 대표자명
        business_number: 사업자등록번호
    """

    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    institution_type: Mapped[str] = mapped_column(String(50), nullable=False, default="clinic")
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    representative: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
