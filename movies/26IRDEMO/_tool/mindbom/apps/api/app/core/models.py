"""기본 모델 정의"""
from datetime import datetime
from uuid import uuid4
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class BaseModel(DeclarativeBase):
    """
    모든 엔티티의 기본 모델

    제공 필드:
    - id: UUID Primary Key
    - created_at: 생성 시각 (UTC)
    - updated_at: 수정 시각 (UTC)
    - deleted_at: 삭제 시각 (UTC, Soft Delete)

    설계 원칙:
    - Foreign Key 제약 없음 (모듈 간 독립성)
    - DB Enum 없음 (application level 관리)
    - Soft Delete: deleted_at으로 삭제 표시
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
        comment="UUID Primary Key",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        comment="생성 시각 (UTC)",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="수정 시각 (UTC)",
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=None,
        comment="삭제 시각 (UTC, Soft Delete)",
    )

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
