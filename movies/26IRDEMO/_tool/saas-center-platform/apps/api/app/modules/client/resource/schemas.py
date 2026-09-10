from enum import Enum
from pydantic import BaseModel, Field


FORM_INSTANCE_RESOURCE_TYPE = "form_instance"


class ClientFormInstanceCreate(BaseModel):
    template_id: str = Field(..., description="폼 템플릿 ID")


class ResourceType(str, Enum):
    PRE_ADMISSION = "pre_admission"   # 초기 상담 기록지
    CONSENT = "consent"               # 동의서
    ASSESSMENT = "assessment"         # 검사지
    OTHER = "other"                   # 기타


class ClientDocumentCreate(BaseModel):
    document_id: str = Field(..., description="문서 ID")
    resource_type: ResourceType = Field(..., description="리소스 유형")
