"""activity_logs 테이블 묘비(legacy).

§4-A 이후 신규 감사는 event_atomics가 정본(§10). 이 모델은 과거 행 보존 + 테이블
등록(migrations/env.py·init-schema.py·lifecycle.py)만을 위해 남긴다 — 읽기/쓰기 코드
없음. 활동로그 live read는 application list_activity(event_atomics)다.
"""
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class ActivityLog(BaseModel):
    __tablename__ = "activity_logs"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})
    actor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "entity_type"})
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index("ix_activity_logs_center_created", "center_id", "created_at"),
        Index("ix_activity_logs_entity", "entity_type", "entity_id", "created_at"),
        Index("ix_activity_logs_actor", "center_id", "actor_id", "created_at"),
        Index("ix_activity_logs_category_action", "center_id", "category", "action"),
    )
