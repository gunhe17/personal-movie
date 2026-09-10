from pydantic import BaseModel, Field

from ..field_note.schemas import NoteTemplateType


class PipelineStepResponse(BaseModel):
    status: str = Field(..., description="스텝 상태 (started, already_completed, precondition_not_met)")
    step: str = Field(..., description="스텝 이름 (transcribe, refine, summary, counseling_note)")
    field_note_id: str = Field(..., description="필드노트 ID")
    message: str | None = Field(None, description="상태 메시지")
    counseling_case_id: str | None = Field(None, description="상담일지가 저장된 상담 케이스 ID")


class GenerateCounselingNoteRequest(BaseModel):
    note_template_type: NoteTemplateType | None = Field(
        None,
        description="노트 서식 타입 (default, soap, dap, birp, family_center). 미지정 시 기존 값 또는 default 사용",
    )


class RecommendationResponse(BaseModel):
    recommendation: str = Field(..., description="AI 생성 상담 추천 텍스트")
