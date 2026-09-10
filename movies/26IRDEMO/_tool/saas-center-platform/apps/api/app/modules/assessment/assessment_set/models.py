from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class AssessmentSet(BaseModel):
    __tablename__ = "assessment_sets"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    assessment_summary: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    center_member_summary: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=None)

    __table_args__ = (
        Index("ix_assessment_sets_center_id", "center_id"),
    )
