"""Password Reset Token 모델"""
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class PasswordResetToken(BaseModel):
    """비밀번호 재설정 토큰 (해시 저장)

    Attributes:
        account_id: 대상 계정 ID
        token_hash: sha256(원본 토큰) — 평문 토큰은 저장하지 않음
        expires_at: 만료 시각 (UTC)
        used_at: 사용 완료 시각 (1회용 보장)
    """

    __tablename__ = "password_reset_tokens"

    account_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
