from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CounselingNoteAiDraftResponse(BaseModel):
    id: str
    counseling_session_id: str
    field_note_id: str
    content: dict = Field(..., description="AI가 생성한 초안 원본 (서식에 따라 키가 다름)")
    summary: str | None
    template_type: str = Field(..., description="생성에 사용한 일지 서식")
    llm_call_id: str | None = Field(None, description="크레딧 사용 내역 연결용")
    author_id: str = Field(..., description="생성을 실행한 멤버")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
