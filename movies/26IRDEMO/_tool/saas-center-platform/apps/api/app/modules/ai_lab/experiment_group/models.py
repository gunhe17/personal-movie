from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class LabExperimentGroup(BaseModel):
    __tablename__ = "lab_experiment_groups"

    sample_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "lab_sample_datasets"})
    best_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "lab_experiment_runs"})
    cheapest_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "lab_experiment_runs"})
    fastest_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "lab_experiment_runs"})
    author_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    experiment_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    total_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_lab_experiment_groups_type", "experiment_type"),
        Index("ix_lab_experiment_groups_sample_id", "sample_id"),
        Index("ix_lab_experiment_groups_status", "status"),
    )
