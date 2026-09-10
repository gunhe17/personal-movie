import math
from dataclasses import dataclass
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.modules.billing.billable.models import Billable, BillableStatus
from app.modules.billing.billable_item.models import BillableItem, BillableItemType


# ── BillableItem 스키마 ──


class BillableItemCreate(BaseModel):
    item_type: BillableItemType = Field(..., description="항목 유형")
    item_id: str | None = Field(default=None, description="서비스/상품 참조 ID")
    related_type: str | None = Field(default=None, description="연관 유형: counseling_session, assessment_session")
    related_case_id: str | None = Field(default=None, description="연관 케이스 ID")
    related_session_id: str | None = Field(default=None, description="연관 세션 ID (회차별 추적)")
    client_voucher_id: str | None = Field(
        default=None,
        description="연결된 내담자 바우처 ID — set 시 생성 단계에서 remaining_sessions를 quantity만큼 차감",
    )
    price_list_id: str | None = Field(default=None, description="단가표 참조 ID")
    description: str = Field(..., max_length=200, min_length=1, description="항목 설명")
    quantity: int = Field(default=1, ge=1, description="수량")
    unit_price: int = Field(..., description="단가")
    provided_at: datetime | None = Field(default=None, description="서비스 제공 일시")
    memo: str | None = Field(default=None, description="메모")


class BillableItemResponse(BaseModel):
    id: str
    billable_id: str
    item_type: BillableItemType
    item_id: str | None = None
    related_type: str | None = None
    related_case_id: str | None = None
    related_case_code: str | None = None
    related_session_id: str | None = None
    client_voucher_id: str | None = None
    voucher_name: str | None = None
    price_list_id: str | None = None
    description: str
    quantity: int
    unit_price: int
    amount: int
    subsidy_amount: int = 0
    provided_at: datetime | None = None
    memo: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Billable 스키마 ──


class BillableCreate(BaseModel):
    client_id: str = Field(..., description="내담자 ID")
    billable_date: date = Field(..., description="청구 일자")
    due_date: date | None = Field(default=None, description="납부 기한")
    memo: str | None = Field(default=None, description="메모")
    discount_amount: int = Field(default=0, ge=0, description="청구서 전체 할인액 (묶음 할인 등)")
    subsidy_amount: int = Field(
        default=0,
        ge=0,
        description=(
            "청구서 전체 바우처 지원금. > 0이면 items 중 최소 1개에 client_voucher_id가 있어야 하며, "
            "사용된 바우처(들)의 remaining_amount에서 차감된다."
        ),
    )
    items: list[BillableItemCreate] = Field(
        ..., min_length=1, description="청구 항목 (최소 1개)"
    )


class BillableUpdate(BaseModel):
    billable_date: date | None = Field(default=None, description="청구 일자")
    due_date: date | None = Field(default=None, description="납부 기한")
    memo: str | None = Field(default=None, description="메모")
    discount_amount: int | None = Field(default=None, ge=0, description="청구서 전체 할인액")


class BillableSummary(BaseModel):
    id: str
    center_id: str
    client_id: str
    client_name: str | None = None
    client_code: str | None = None
    client_birth_date: date | None = None
    client_gender: str | None = None
    client_profile_image_url: str | None = None
    billable_date: date
    total_amount: int
    discount_amount: int = 0
    subsidy_amount: int = 0
    paid_amount: int
    unpaid_amount: int
    status: BillableStatus
    item_count: int = 0
    item_summary: str = ""
    is_package: bool = False
    case_codes: list[str] = []
    related_session_ids: list[str] = []
    issued_at: datetime | None = None
    due_date: date | None = None
    created_by: str = ""
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillableResponse(BaseModel):
    id: str
    center_id: str
    client_id: str
    client_name: str | None = None
    client_code: str | None = None
    client_birth_date: date | None = None
    client_gender: str | None = None
    client_profile_image_url: str | None = None
    billable_date: date
    total_amount: int
    discount_amount: int = 0
    subsidy_amount: int = 0
    paid_amount: int
    unpaid_amount: int
    status: BillableStatus
    issued_at: datetime | None = None
    due_date: date | None = None
    memo: str | None = None
    created_by: str
    created_by_name: str | None = None
    items: list[BillableItemResponse] = []
    # 생성 과정에서 발생한 비차단 경고 (예: 바우처 잔여 금액 부족)
    warnings: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# 바우처 차감(voucher_*_consumption)은 voucher 모듈 소관 — application handler가 이 계획을 받아 차감
@dataclass
class BillableCreateResult:
    billable: Billable
    items: list[BillableItem]
    client_id: str
    billable_date: date
    voucher_consumption: dict[str, int]
    voucher_amount_consumption: dict[str, int]


class BillableListResponse(BaseModel):
    items: list[BillableSummary]
    total: int
    page: int
    size: int
    pages: int
    # 필터 스코프 전체(페이지 무관)의 미수금 합계
    unpaid_total: int = 0

    @classmethod
    def build(
        cls,
        items: list[BillableSummary],
        total: int,
        page: int,
        size: int,
        unpaid_total: int = 0,
    ) -> "BillableListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
            unpaid_total=unpaid_total,
        )


class BillablePrefillItem(BaseModel):
    reference_id: str = Field(description="매칭 키 (set_id, assessment_id, program_id)")
    description: str = Field(description="항목 설명 (표시용)")
    item_type: BillableItemType = Field(description="항목 유형 (service/package/product)")
    unit_price: int = Field(default=0, description="단가 (단가표 매칭 실패 시 0)")
    price_list_id: str | None = Field(default=None, description="단가표 ID (매칭 실패 시 null)")
    # 바우처 연동 (상담 케이스에 client_voucher가 연결돼있을 때만 set)
    # 정책: 단가는 voucher로 덮어쓰지 않음 — 바우처 정보는 참고용 표시 + 회기 차감 트리거 용도
    client_voucher_id: str | None = Field(
        default=None,
        description="연결된 내담자 바우처 ID — 청구 생성 시 회기 차감 트리거",
    )
    voucher_name: str | None = Field(
        default=None, description="바우처 표시명 (프론트 배지용)"
    )
    voucher_remaining: int | None = Field(
        default=None, description="바우처 잔여 회기 (프론트 배지용)"
    )
    voucher_total: int | None = Field(
        default=None, description="바우처 총 회기 (프론트 배지용)"
    )
    voucher_support_amount_text: str | None = Field(
        default=None,
        description="카탈로그의 표준 지원금 안내 텍스트 (예: '회당 5만원') — 사용자 입력 참고용",
    )


def fill_summary_from_items(
    summary: BillableSummary, items: list[BillableItem]
) -> BillableSummary:
    # is_package: 세트 패키지 또는 상담 케이스 선결제. 일정 없이 접수된 검사 단건(assessment_case+service)은 아님.
    # case_codes는 비워둠 — handler가 타 모듈 facade로 사후 보강.
    item_count = len(items)
    item_summary = items[0].description if items else ""
    if item_count > 1:
        item_summary += f" 외 {item_count - 1}건"

    summary.item_count = item_count
    summary.item_summary = item_summary
    summary.is_package = any(
        item.item_type == "package"
        or (item.related_type or "") == "counseling_case"
        for item in items
    )
    summary.related_session_ids = [
        item.related_session_id for item in items if item.related_session_id
    ]
    return summary
