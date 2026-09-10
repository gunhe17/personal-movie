from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AssistantConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class AssistantTurnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_message: str
    events: list
    completion: str | None
    status: str
    created_at: datetime


class AssistantConversationDetailResponse(AssistantConversationResponse):
    turns: list[AssistantTurnResponse]


class AssistantConversationListResponse(BaseModel):
    items: list[AssistantConversationResponse]
    total: int
    page: int
    size: int
    pages: int


class AssistantConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class AssistantStreamRequest(BaseModel):
    message: str


class AssistantResumeRequest(BaseModel):
    input: str | dict[str, Any]
    is_form: bool = False
    cancelled: bool = (
        False  # [확인/취소] 버튼의 구조화 플래그 — 서버 취소 단어 목록 없음
    )
