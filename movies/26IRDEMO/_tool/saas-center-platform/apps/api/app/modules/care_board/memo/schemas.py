from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CareMemoCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CareMemoUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CareMemoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    client_id: str
    author_id: str
    body: str
    edited_by: str | None = None
    edited_at: datetime | None = None
    created_at: datetime
