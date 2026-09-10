from enum import Enum

from sqlalchemy import Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class RoleCode(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    COUNSELOR = "COUNSELOR"
    STAFF = "STAFF"


# all=센터 전체 / own=본인 담당만 — 데이터 접근 범위
class RoleAccessLevel(str, Enum):
    ALL = "all"
    OWN = "own"


# #
# model

class Role(BaseModel):
    __tablename__ = "roles"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    access_level: Mapped[str] = mapped_column(String(20), nullable=False, default="own")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index(
            "uq_role_center_code",
            "center_id",
            "code",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
