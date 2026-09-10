import math
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.billing.price_list.models import ServiceType


# ── 요청 스키마 ──


class PriceListCreate(BaseModel):
    service_type: ServiceType = Field(..., description="서비스 유형")
    service_name: str = Field(..., max_length=100, min_length=1, description="서비스명")
    reference_id: str | None = Field(default=None, description="연관 리소스 ID (검사/상담/세트)")
    unit_price: int = Field(default=0, ge=0, description="단가 (원)")
    is_active: bool = Field(default=True, description="활성화 여부")
    memo: str | None = Field(default=None, description="메모")
    source: str = Field(default="manual", description="등록 출처: manual, synced")


class PriceListUpdate(BaseModel):
    service_type: ServiceType | None = Field(default=None, description="서비스 유형")
    service_name: str | None = Field(default=None, max_length=100, min_length=1, description="서비스명")
    reference_id: str | None = Field(default=None, description="연관 리소스 ID (검사/상담/세트)")
    unit_price: int | None = Field(default=None, ge=0, description="단가 (원)")
    is_active: bool | None = Field(default=None, description="활성화 여부")
    memo: str | None = Field(default=None, description="메모")


# ── 응답 스키마 ──


class PriceListDeleteResponse(BaseModel):
    detail: str


class PriceListResponse(BaseModel):
    id: str
    center_id: str
    service_type: ServiceType
    service_name: str
    reference_id: str | None = None
    unit_price: int
    is_active: bool
    memo: str | None = None
    source: str = "manual"
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PriceListListResponse(BaseModel):
    items: list[PriceListResponse]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[PriceListResponse],
        total: int,
        page: int,
        size: int,
    ) -> "PriceListListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
