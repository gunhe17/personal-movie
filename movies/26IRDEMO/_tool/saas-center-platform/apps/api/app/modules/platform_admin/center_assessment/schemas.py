from pydantic import BaseModel


class AssignAssessmentRequest(BaseModel):
    assessment_id: str


class ToggleAssessmentRequest(BaseModel):
    is_active: bool
