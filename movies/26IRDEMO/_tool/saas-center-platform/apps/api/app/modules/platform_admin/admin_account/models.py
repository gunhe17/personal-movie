from enum import Enum, nonmember
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    CUSTOMER_SERVICE = "customer_service"
    # staging DB 하위호환 — authz 통과만 허용, 신규 할당 금지(ALL 미포함)
    LEGACY_SYSTEM_ADMIN = "system_admin"

    # 그룹 상수는 Enum 본문에 두면 멤버로 오인되므로 nonmember로 고정
    ALL = nonmember([SUPER_ADMIN, ADMIN, CUSTOMER_SERVICE])

    # authz 그룹 — auth/dependencies·router가 파생 사용(프론트 permissions.ts와 동일 계층)
    SUPER_PLUS = nonmember((LEGACY_SYSTEM_ADMIN, SUPER_ADMIN))
    ADMIN_PLUS = nonmember((LEGACY_SYSTEM_ADMIN, SUPER_ADMIN, ADMIN))


# #
# model

class AdminAccount(BaseModel):
    __tablename__ = "admin_accounts"

    role: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index(
            "uq_admin_accounts_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
