from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .sensitivity import detect_sensitive_categories


class ShareContent(BaseModel):
    text: str | None = Field(None, max_length=4000, description="전달문 본문(문단은 줄바꿈 두 번)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "text": (
                    "오늘은 지우가 학교에서 짝과 다퉜던 일을 먼저 꺼내서 이야기했어요. "
                    "그 상황에서 어떻게 말하면 좋을지 함께 연습해봤어요.\n\n"
                    "지난번보다 훨씬 더 많이 이야기했어요. 다만 잘못을 자기 탓으로 "
                    "돌리는 말이 여러 번 나왔어요."
                )
            }
        }
    )


class NoteShareGenerateRequest(BaseModel):
    client_id: str
    audience: str | None = Field(None, description="읽는 사람 (guardian | self). 미지정 시 나이로 판단")


class NoteShareUpdateRequest(BaseModel):
    content: ShareContent


class CounselingNoteShareResponse(BaseModel):
    id: str
    center_id: str
    counseling_session_id: str
    client_id: str
    counseling_note_id: str | None
    author_id: str
    llm_call_id: str | None = Field(None, description="크레딧 사용 내역 연결용")
    audience: str = Field(..., description="guardian | self")
    status: str = Field(..., description="draft | published")
    content: dict
    is_edited: bool = Field(..., description="AI 초안을 상담사가 손봤는지")
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def sensitive_categories(self) -> list[str]:
        # 발행 직전 고지용 — 차단이 아니라 "무엇이 걸렸는지" 알리는 값
        return detect_sensitive_categories(self.content)

    model_config = ConfigDict(from_attributes=True)
