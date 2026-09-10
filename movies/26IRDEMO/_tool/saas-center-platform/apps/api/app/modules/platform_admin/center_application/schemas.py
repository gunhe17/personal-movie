import math
from datetime import datetime

from pydantic import BaseModel


class AdminApplicationSummary(BaseModel):
    id: str
    center_name: str
    applicant_name: str
    applicant_email: str
    business_registration_number: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_reason: str | None


class AdminApplicationDetailResponse(BaseModel):
    id: str
    center_name: str
    applicant_name: str
    applicant_email: str
    phone: str | None
    address: dict | None
    description: str | None
    business_registration_number: str | None
    representative_name: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by: str | None
    reviewed_reason: str | None
    center_id: str | None
    updated_at: datetime


class AdminApplicationListResponse(BaseModel):
    items: list[AdminApplicationSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminApplicationSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminApplicationListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


class ApproveApplicationResponse(BaseModel):
    message: str
    center_id: str
