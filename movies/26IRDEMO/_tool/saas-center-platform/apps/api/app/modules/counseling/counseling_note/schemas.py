from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict


class NoteContent(BaseModel):
    mood: str | None = Field(None, description="내담자 기분/정서")
    main_topic: str | None = Field(None, description="주요 주제")
    intervention: list[str] | None = Field(None, description="사용한 개입 기법")
    progress: str | None = Field(None, description="진전 사항")
    homework: str | None = Field(None, description="과제")
    next_goal: str | None = Field(None, description="다음 회기 목표")
    raw_notes: str | None = Field(None, description="자유 형식 노트")
    private_notes: str | None = Field(None, description="비공개 메모 (작성자만 열람)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "mood": "우울감, 불안",
                "main_topic": "직장 내 대인관계 갈등",
                "intervention": ["인지 재구성", "역할극"],
                "progress": "자동적 사고 인식 향상",
                "homework": "사고 기록지 작성",
                "next_goal": "대안적 사고 연습",
                "raw_notes": "오늘 상담에서..."
            }
        }
    )


class CounselingNoteCreate(BaseModel):
    client_id: str = Field(..., description="내담자 ID")
    content: NoteContent = Field(..., description="노트 내용")
    summary: str | None = Field(None, max_length=1000, description="요약")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "client_id": "123e4567-e89b-12d3-a456-426614174000",
                "content": {
                    "mood": "우울감",
                    "main_topic": "대인관계",
                    "intervention": ["인지 재구성"],
                    "progress": "자동적 사고 인식 향상"
                },
                "summary": "직장 내 대인관계 갈등에 대한 인지 재구성 작업"
            }
        }
    )


class CounselingNoteUpdate(BaseModel):
    content: NoteContent | None = Field(None, description="노트 내용")
    summary: str | None = Field(None, max_length=1000, description="요약")


class CounselingNoteResponse(BaseModel):
    id: str
    center_id: str
    counseling_session_id: str
    client_id: str
    content: dict[str, Any]
    summary: str | None
    author_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
