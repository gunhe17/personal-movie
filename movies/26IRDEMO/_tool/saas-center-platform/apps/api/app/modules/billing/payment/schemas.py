from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.billing.payment.models import PaymentMethod


# ── 요청 스키마 ──

class PaymentCreate(BaseModel):
    amount: int = Field(..., gt=0, description="결제 금액")
    payment_method: PaymentMethod = Field(..., description="결제 수단")
    paid_at: datetime = Field(..., description="결제 일시")
    receipt_number: str | None = Field(default=None, max_length=50, description="영수증 번호 (미입력 시 자동 생성)")
    memo: str | None = Field(default=None, description="메모")


# ── 응답 스키마 ──

class PaymentResponse(BaseModel):
    id: str
    billable_id: str
    amount: int
    payment_method: PaymentMethod
    paid_at: datetime
    receipt_number: str | None = None
    memo: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    items: list[PaymentResponse]
    total_paid: int
