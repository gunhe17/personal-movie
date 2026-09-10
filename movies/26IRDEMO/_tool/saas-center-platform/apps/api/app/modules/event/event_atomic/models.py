from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class EventAtomic(BaseModel):
    __tablename__ = "event_atomics"

    event_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "events"})
    # 타깃 = 전 엔티티 개방 집합(entity_name 판별) — 정적 reference_tables 매핑 불가
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_type_field": "entity_name"})
    entity_name: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    act: Mapped[str] = mapped_column(String(30), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
