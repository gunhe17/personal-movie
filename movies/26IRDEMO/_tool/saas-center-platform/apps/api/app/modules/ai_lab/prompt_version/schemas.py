from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PromptVersionCreate(BaseModel):
    prompt_key: str
    name: str
    system_prompt: str
    user_prompt_template: str | None = None
    description: str | None = None


class PromptVersionUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    is_active: bool | None = None
    description: str | None = None


class PromptVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prompt_key: str
    version: int
    name: str
    system_prompt: str
    user_prompt_template: str | None = None
    author_id: str | None = None
    is_active: bool
    is_production: bool
    description: str | None = None
    created_at: datetime
    updated_at: datetime
