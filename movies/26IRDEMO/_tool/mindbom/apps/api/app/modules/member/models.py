"""기관 멤버 모델"""
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Member(BaseModel):
    """기관 소속 멤버

    Attributes:
        institution_id: 기관 ID
        account_id: 계정 ID
        role: 역할 (admin, clinician, researcher)
        name: 표시 이름
        license_number: 자격증 번호 (임상심리사 등)
        is_active: 활성 상태
    """

    __tablename__ = "members"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="clinician")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    license_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
