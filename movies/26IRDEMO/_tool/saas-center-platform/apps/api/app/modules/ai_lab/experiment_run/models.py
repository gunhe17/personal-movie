from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class LabExperimentRun(BaseModel):
    __tablename__ = "lab_experiment_runs"

    field_note_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "field_notes"})
    field_note_audio_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "field_note_audios"})
    sample_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "lab_sample_datasets"})
    group_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "lab_experiment_groups"})
    prompt_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "lab_prompt_versions"})
    author_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    experiment_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="openai")
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_audio_duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    model_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_note: Mapped[str | None] = mapped_column(Text, nullable=True)
