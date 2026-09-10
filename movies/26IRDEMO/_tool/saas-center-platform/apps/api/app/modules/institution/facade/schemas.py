from pydantic import BaseModel


class InstitutionSummary(BaseModel):
    # AssessmentCase.institution_summary JSONB에 스냅샷으로 저장됨
    institution_id: str
    name: str
    phone: str | None = None
    address: str | None = None
