from pydantic import BaseModel, Field

FORM_INSTANCE_RESOURCE_TYPE = "form_instance"


class VoucherFormInstanceCreate(BaseModel):
    template_id: str = Field(..., description="폼 템플릿 ID")
