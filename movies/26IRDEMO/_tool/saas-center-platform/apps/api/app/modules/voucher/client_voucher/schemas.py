import math
from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field, model_validator

from app.modules.voucher.voucher.support_amount import format_support_amount


# ── 요청 스키마 ──


class ClientVoucherCreate(BaseModel):
    client_id: str = Field(..., description="내담자 client.id")
    center_voucher_id: str = Field(..., description="센터 취급 바우처 center_voucher.id")
    total_sessions: int = Field(..., ge=1, description="총 회기")
    remaining_sessions: int | None = Field(
        default=None, ge=0, description="잔여 회기 (생략 시 total_sessions로 자동 설정)"
    )
    # 금액 (옵션, 통지서 잔액 원액 그대로 입력)
    total_amount: int | None = Field(
        default=None, ge=0, description="발급 시점 잔여 금액 원액 (옵션)"
    )
    remaining_amount: int | None = Field(
        default=None,
        description="잔여 금액 (생략 시 total_amount로 자동 설정. 음수 허용)",
    )
    valid_from: date | None = Field(default=None, description="유효기간 시작일")
    valid_until: date | None = Field(default=None, description="유효기간 종료일")

    @model_validator(mode="after")
    def check_remaining(self) -> "ClientVoucherCreate":
        if self.remaining_sessions is None:
            self.remaining_sessions = self.total_sessions
        if self.remaining_sessions > self.total_sessions:
            raise ValueError("remaining_sessions는 total_sessions를 초과할 수 없습니다")
        return self

    @model_validator(mode="after")
    def check_remaining_amount(self) -> "ClientVoucherCreate":
        # remaining_amount 미지정 시 total_amount로 자동 (total_amount가 있을 때만)
        if self.remaining_amount is None and self.total_amount is not None:
            self.remaining_amount = self.total_amount
        # remaining_amount는 음수 허용 (운영 보정), 다만 total_amount보다 큰 건 차단
        if (
            self.total_amount is not None
            and self.remaining_amount is not None
            and self.remaining_amount > self.total_amount
        ):
            raise ValueError(
                "remaining_amount는 total_amount를 초과할 수 없습니다"
            )
        return self

    @model_validator(mode="after")
    def check_dates(self) -> "ClientVoucherCreate":
        if (
            self.valid_from is not None
            and self.valid_until is not None
            and self.valid_from > self.valid_until
        ):
            raise ValueError("valid_from은 valid_until보다 이후일 수 없습니다")
        return self


class ClientVoucherUpdate(BaseModel):
    total_sessions: int | None = Field(default=None, ge=1)
    remaining_sessions: int | None = Field(default=None, ge=0)
    total_amount: int | None = Field(default=None, ge=0)
    remaining_amount: int | None = Field(default=None)  # 음수 허용 (보정)
    valid_from: date | None = None
    valid_until: date | None = None


# ── 응답 스키마 ──


class ClientVoucherDeleteResponse(BaseModel):
    detail: str


class CenterVoucherSummary(BaseModel):
    id: str
    catalog_id: str
    unit_price: int | None = None

    model_config = {"from_attributes": True}


class CatalogSummary(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int
    support_amount: dict | None = None
    # 이 사업에 연결된 서식 템플릿 id — 이름은 소비자가 서식 목록에서 해소한다
    # (form 모듈 데이터라 여기서 조인하지 않는다)
    form_template_ids: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def support_amount_text(self) -> str | None:
        return format_support_amount(self.support_amount)


class ClientVoucherResponse(BaseModel):
    id: str
    center_id: str
    client_id: str
    center_voucher_id: str
    # 호환용 필드 — v3에서 case_id 직접 연결 끊음. 항상 null 반환. PR-C에서 제거 예정.
    case_id: str | None = None
    total_sessions: int
    remaining_sessions: int
    total_amount: int | None = None
    remaining_amount: int | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    # 조립 (선택적)
    center_voucher: CenterVoucherSummary | None = None
    catalog: CatalogSummary | None = None

    model_config = {"from_attributes": True}


class ClientVoucherListResponse(BaseModel):
    items: list[ClientVoucherResponse]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[ClientVoucherResponse],
        total: int,
        page: int,
        size: int,
    ) -> "ClientVoucherListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── 사용 증빙 스키마 (v3) ──


class VoucherUsageItem(BaseModel):
    billable_item_id: str
    billable_id: str
    billable_date: date
    description: str
    quantity: int
    amount: int
    subsidy_amount: int
    related_case_id: str | None = None
    related_session_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VoucherUsageResponse(BaseModel):
    client_voucher_id: str
    items: list[VoucherUsageItem]
    total_sessions_used: int
    total_amount_used: int
    total_subsidy_used: int


class VoucherMonthlyUsageItem(BaseModel):
    year_month: str  # 'YYYY-MM'
    sessions: int
    amount: int
    subsidy_amount: int
    item_count: int


class VoucherMonthlyUsageResponse(BaseModel):
    client_voucher_id: str
    items: list[VoucherMonthlyUsageItem]
