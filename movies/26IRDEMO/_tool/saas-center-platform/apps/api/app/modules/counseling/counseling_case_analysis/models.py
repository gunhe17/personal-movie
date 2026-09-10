from sqlalchemy import Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CounselingCaseAnalysis(BaseModel):
    __tablename__ = "counseling_case_analyses"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    counseling_case_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "counseling_cases"})
    triggered_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing", server_default="completed", comment="상태: processing/completed/failed")
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(80), nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    session_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index("idx_case_analysis_center", "center_id"),
        Index("idx_case_analysis_case", "counseling_case_id"),
    )
