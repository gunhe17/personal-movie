from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProductionAIConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    module: str
    pipeline_step: str
    model_name: str
    provider: str
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_params: str | None = None
    promoted_from_version_id: str | None = None
    promoted_by: str | None = None
    promoted_at: datetime | None = None
    is_active: bool
    description: str | None = None
    diarization_strategy: str | None = None
    created_at: datetime
    updated_at: datetime


class PromoteToProductionRequest(BaseModel):
    module: str = "field_note"
    pipeline_step: str
    prompt_version_id: str | None = None
    model_name: str
    provider: str = "openai"
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_params: dict[str, Any] | None = None
    description: str | None = None
    diarization_strategy: str | None = None
