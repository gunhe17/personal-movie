from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ProductionAIConfig(BaseModel):
    __tablename__ = "production_ai_configs"

    promoted_from_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "lab_prompt_versions"})
    promoted_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "admin_accounts"})
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    module: Mapped[str] = mapped_column(String(30), nullable=False, default="field_note")
    pipeline_step: Mapped[str] = mapped_column(String(50), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="openai")
    diarization_strategy: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    model_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "ix_production_ai_configs_step_active",
            "pipeline_step", "is_active",
        ),
        Index(
            "ix_production_ai_configs_module_step_active",
            "module", "pipeline_step", "is_active",
        ),
    )
