from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class EventReaction(BaseModel):
    __tablename__ = "event_reactions"
    __table_args__ = (UniqueConstraint("event_id", "reaction", name="uq_event_reaction"),)

    event_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "events"})
    reaction: Mapped[str] = mapped_column(String(100), nullable=False)
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
