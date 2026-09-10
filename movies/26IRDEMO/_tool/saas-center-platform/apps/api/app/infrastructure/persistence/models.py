from datetime import datetime
from uuid import uuid4
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class BaseModel(DeclarativeBase):
    """모든 엔티티의 기본 모델 (audit 필드 + soft delete).

    설계 원칙: Foreign Key 제약 없음(모듈 간 독립성), DB Enum 없음(application level 관리),
    삭제는 물리 삭제 대신 deleted_at 으로 표시(soft delete).
    """

    __abstract__ = True

    # sort_order — 상속 컬럼은 기본적으로 서브클래스 뒤로 밀린다. PK가 표 중간에 박히지 않게
    # 앞뒤로 고정한다(SQLAlchemy 2.0.4+). 전 테이블의 컬럼 순서가 이 값으로 정해진다.
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
        comment="UUID Primary Key",
        sort_order=-100,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        comment="생성 시각 (UTC)",
        sort_order=100,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="수정 시각 (UTC)",
        sort_order=101,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=None,
        comment="삭제 시각 (UTC, Soft Delete)",
        sort_order=102,
    )

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
