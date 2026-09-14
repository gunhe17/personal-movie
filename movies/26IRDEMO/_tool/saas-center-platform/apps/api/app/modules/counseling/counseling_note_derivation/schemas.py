from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteDerivationCreateRequest(BaseModel):
    client_id: str
    kind: str | None = Field(
        None,
        description="제출 서류 종류(기록지·보고서 등). 미지정 시 바우처에 걸린 첫 양식",
    )


# content = {template_id, template_name, instance_id, client_voucher_id, values{field_key: 값}}.
# 양식 인스턴스 id 를 별도 컬럼으로 두지 않는다 — 파생 1건이 곧 양식 1장이고,
# 이 표는 '무엇을 무엇으로 옮겼나'의 기록이라 content 안에 같이 산다.
class CounselingNoteDerivationResponse(BaseModel):
    id: str
    center_id: str
    counseling_note_id: str
    counseling_session_id: str
    client_id: str
    author_id: str
    llm_call_id: str | None = None
    status: str = Field(..., description="draft | published")
    kind: str = Field(..., description="제출 서류 종류 — voucher_form_templates.kind")
    content: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
