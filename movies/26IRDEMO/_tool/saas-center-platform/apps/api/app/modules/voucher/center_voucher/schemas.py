import math
from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field

from app.modules.voucher.voucher.support_amount import format_support_amount


class CenterVoucherCreate(BaseModel):
    catalog_id: str = Field(..., description="카탈로그 voucher.id")
    unit_price: int | None = Field(default=None, ge=0, description="회기당 단가 (원, 참고용)")
    default_total_sessions: int | None = Field(default=None, ge=1, description="기본 총 회기")
    is_active: bool = Field(default=True, description="취급 활성 여부")
    memo: str | None = Field(default=None, description="센터 내부 메모")


class CenterVoucherUpdate(BaseModel):
    unit_price: int | None = Field(default=None, ge=0, description="회기당 단가 (원, 참고용)")
    default_total_sessions: int | None = Field(default=None, ge=1, description="기본 총 회기")
    is_active: bool | None = Field(default=None, description="취급 활성 여부")
    memo: str | None = Field(default=None, description="센터 내부 메모")


# ── 응답 스키마 ──


class CenterVoucherDeleteResponse(BaseModel):
    detail: str


class CatalogSummary(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int
    # 정부 고시 지원금 구조화 정보 (dict). 센터는 참고용으로만 표시 — 실제 지원금은 발급기관 통지서를 따른다.
    support_amount: dict | None = None
    # 사업 이용 가능 기간 (내담자 바우처 유효기간 기본값으로 사용)
    usage_start_date: date | None = None
    usage_end_date: date | None = None
    # 이 사업에 연결된 서식 템플릿 id — 이름은 소비자가 서식 목록에서 해소한다
    # (form 모듈 데이터라 여기서 조인하지 않는다)
    form_template_ids: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def support_amount_text(self) -> str | None:
        return format_support_amount(self.support_amount)


class CenterVoucherResponse(BaseModel):
    id: str
    center_id: str
    catalog_id: str
    unit_price: int | None = None
    default_total_sessions: int | None = None
    is_active: bool
    memo: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    # 카탈로그 join 결과 (선택적 — Service에서 채움)
    catalog: CatalogSummary | None = None

    model_config = {"from_attributes": True}


class CenterVoucherListResponse(BaseModel):
    items: list[CenterVoucherResponse]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[CenterVoucherResponse],
        total: int,
        page: int,
        size: int,
    ) -> "CenterVoucherListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── 카탈로그 (센터 시점) ──


class VoucherCatalogItem(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int
    usage_start_date: date | None = None
    usage_end_date: date | None = None
    support_amount: dict | None = None
    is_taken: bool
    is_expired: bool = False

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def support_amount_text(self) -> str | None:
        return format_support_amount(self.support_amount)


class VoucherCatalogListResponse(BaseModel):
    items: list[VoucherCatalogItem]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[VoucherCatalogItem],
        total: int,
        page: int,
        size: int,
    ) -> "VoucherCatalogListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── 통계 스키마 ──


class CenterVoucherClientItem(BaseModel):
    client_voucher_id: str
    client_id: str
    client_name: str
    # 내담자 표시 최소 단위(아바타 + 이름 + 생년월일|성별) — 화면 공통 규격
    birth_date: date | None = None
    gender: str | None = None
    profile_image_url: str | None = None
    remaining_sessions: int
    total_sessions: int
    remaining_amount: int | None = None
    total_amount: int | None = None
    valid_from: date | None = None
    valid_until: date | None = None


class CenterVoucherClientsResponse(BaseModel):
    items: list[CenterVoucherClientItem]
    total: int
    page: int
    size: int
    pages: int


class CenterVoucherStatsPerItem(BaseModel):
    center_voucher_id: str
    active_client_count: int


class CenterVoucherDocumentLink(BaseModel):
    global_document_id: str
    page_range: str | None = None


class CenterVoucherDocumentItem(BaseModel):
    global_document_id: str
    name: str
    file_type: str = Field(..., description="확장자/타입 (pdf·hwpx 등, md 등 내부 산출물 제외)")
    page_range: str | None = Field(
        default=None,
        description="자료 내 해당 사업 인쇄 페이지 범위 (예: '12-20')",
    )
    note: str | None = None
    has_file: bool = Field(
        default=True, description="다운로드 가능한 원본 파일 보유 여부"
    )


class CenterVoucherDocumentsResponse(BaseModel):
    items: list[CenterVoucherDocumentItem]


class CenterVoucherStatsResponse(BaseModel):
    active_count: int = Field(..., description="활성 취급 사업 수")
    total_count: int = Field(..., description="총 취급 사업 수")
    active_client_voucher_count: int = Field(
        ..., description="진행중 내담자 바우처 수 (잔여 회기 > 0, 만료 안 됨)"
    )
    expiring_within_days_count: int = Field(
        ..., description="N일 내 만료 임박 내담자 바우처 수"
    )
    expiring_window_days: int = Field(
        default=60, description="만료 임박 기준 일수"
    )
    per_voucher: list[CenterVoucherStatsPerItem] = Field(
        default_factory=list,
        description="바우처별 사용 내담자 수 (진행중 기준)",
    )
