from sqlalchemy import Boolean, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CenterAssessment(BaseModel):
    __tablename__ = "center_assessments"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    assessment_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "assessments"})
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("center_id", "assessment_id", name="uq_center_assessment"),
        Index("ix_center_assessments_center_id", "center_id"),
        Index("ix_center_assessments_assessment_id", "assessment_id"),
    )
