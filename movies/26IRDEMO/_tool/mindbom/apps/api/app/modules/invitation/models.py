"""직원 초대 토큰 모델"""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Invitation(BaseModel):
    """직원 초대 (토큰은 해시 저장)

    상태:
        pending  — 발송됨, 만료/수락/취소 전
        accepted — 초대받은 사람이 비밀번호를 설정해 가입 완료
        revoked  — 관리자 취소 또는 재발송으로 무효화

    만료(expires_at)는 별도의 status 값을 갖지 않고 verify 시점에서 lazy 판정한다
    (password_reset 모듈과 동일 정책).
    """

    __tablename__ = "invitations"

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="clinician")
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    invited_by_account_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
