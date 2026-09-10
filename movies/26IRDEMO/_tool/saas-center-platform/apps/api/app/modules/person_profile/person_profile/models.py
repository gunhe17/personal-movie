from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model


class PersonProfile(BaseModel):
    __tablename__ = "person_profiles"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, info={"reference_table_name": "members"}
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # LLM 분석 횟수
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # LLM 분석 시각 — stale 판정 기준
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        Index(
            "uq_person_profiles_center_member_active",
            "center_id",
            "member_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
