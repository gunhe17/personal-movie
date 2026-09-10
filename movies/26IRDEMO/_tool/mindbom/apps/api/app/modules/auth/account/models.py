"""Account 모델"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Account(BaseModel):
    """사용자 계정

    Attributes:
        email: 로그인 이메일 (유니크)
        password_hash: 해시된 비밀번호
        name: 사용자 이름
        token_version: 토큰 무효화 버전 (권한 변경 시 증가)
        is_active: 활성 상태
        failed_login_attempts: 연속 로그인 실패 횟수 (성공 시 0으로 리셋)
        lockout_until: 계정 잠금 만료 시각 (5회 실패 시 15분)
        last_login_at: 최근 성공 로그인 시각
        last_login_ip: 최근 성공 로그인 IP
    """

    __tablename__ = "accounts"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lockout_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    last_login_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
