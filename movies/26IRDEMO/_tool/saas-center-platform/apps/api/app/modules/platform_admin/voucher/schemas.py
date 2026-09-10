# Admin Voucher 스키마 (재정의 모델).
#
# 신 모델:
# - voucher_files / voucher_file_links 제거 → global_documents + voucher_documents
# - voucher_drafts 제거 → voucher_extractions (업로드 즉시 추출 시작)
#
# 런타임 가공 산출(completed.vouchers)은 runtime/voucher_document 가 정의하는 리치
# 스키마(`{no, name, code, span, fields:{12키}}`, 값 노드 `{value, page, quote,
# quote_pdf, match}`)다 — 이 모듈의 Pydantic 모델이 아니라 JSON dict 로 흐른다.
# 업로드 입력 enum 인 VoucherFileType 만 런타임/핸들러가 공유한다.
import math
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# ── Enum ──


class VoucherFileType(str, Enum):
    BUSINESS_GUIDE = "business_guide"
    MANUAL = "manual"
    FORM = "form"
    SUPPLEMENTARY = "supplementary"
    NOTICE = "notice"


# ── 공통 page_range 검증 ──


def _validate_page_range(
    v: tuple[int, int] | None,
) -> tuple[int, int] | None:
    if v is None:
        return None
    low, high = v
    if low < 0 or high < 0:
        raise ValueError("page_range 값은 0 이상이어야 합니다")
    if low > high:
        raise ValueError("page_range 시작 값이 끝 값보다 큽니다")
    return v


# ── Voucher Request ──


class AdminVoucherCreateLinkPayload(BaseModel):
    global_document_id: str
    page_range: tuple[int, int] | None = None

    @field_validator("page_range")
    @classmethod
    def _check_range(
        cls, v: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        return _validate_page_range(v)


class AdminVoucherCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    program_name: str = Field(..., max_length=255)
    program_organization: str = Field(..., max_length=255)
    program_year: int = Field(..., ge=1900, le=2999)

    usage_start_date: date | None = None
    usage_end_date: date | None = None
    application_method: str | None = None
    application_start_date: date | None = None
    application_end_date: date | None = None

    support_amount: dict | None = None
    support_scope: str | None = None
    support_target: str | None = None
    contact: str | None = None
    eligibility: dict | None = None

    # 등록과 함께 생성할 자료 연결 (옵션). 같은 트랜잭션 — 일부 실패 시 전체 롤백.
    document_links: list[AdminVoucherCreateLinkPayload] = Field(
        default_factory=list
    )


class AdminVoucherUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    program_name: str | None = Field(default=None, max_length=255)
    program_organization: str | None = Field(default=None, max_length=255)
    program_year: int | None = Field(default=None, ge=1900, le=2999)

    usage_start_date: date | None = None
    usage_end_date: date | None = None
    application_method: str | None = None
    application_start_date: date | None = None
    application_end_date: date | None = None

    support_amount: dict | None = None
    support_scope: str | None = None
    support_target: str | None = None
    contact: str | None = None
    eligibility: dict | None = None
    record: dict | None = None


# ── Voucher Response ──


class AdminVoucherSummary(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int
    usage_start_date: date | None = None
    usage_end_date: date | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminVoucherDocumentRef(BaseModel):
    id: str
    name: str
    file_type: str = Field(description="확장자 (pdf·hwpx·md ...)")
    page_range: tuple[int, int] | None = None
    deleted_at: datetime | None = None


class AdminVoucherDetailResponse(BaseModel):
    id: str
    name: str
    program_name: str
    program_organization: str
    program_year: int

    usage_start_date: date | None = None
    usage_end_date: date | None = None
    application_method: str | None = None
    application_start_date: date | None = None
    application_end_date: date | None = None

    support_amount: dict | None = None
    support_scope: str | None = None
    support_target: str | None = None
    contact: str | None = None
    eligibility: dict | None = None
    record: dict | None = None

    documents: list[AdminVoucherDocumentRef] = []

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminVoucherListResponse(BaseModel):
    items: list[AdminVoucherSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls, items: list[AdminVoucherSummary], total: int, page: int, size: int
    ) -> "AdminVoucherListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── Document 카탈로그 (링크 후보 picker) ──


class AdminDocumentSummary(BaseModel):
    id: str
    name: str
    file_type: str = Field(description="확장자 (pdf·hwpx·md ...)")
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminDocumentListResponse(BaseModel):
    items: list[AdminDocumentSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminDocumentSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminDocumentListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── Voucher ↔ Document Link (voucher_documents) ──


class VoucherDocumentLinkCreateRequest(BaseModel):
    global_document_id: str
    page_range: tuple[int, int] | None = None

    @field_validator("page_range")
    @classmethod
    def _check_range(
        cls, v: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        return _validate_page_range(v)


class VoucherDocumentLinkResponse(BaseModel):
    id: str
    voucher_id: str
    global_document_id: str
    page_range: tuple[int, int] | None = None

    name: str | None = None
    file_type: str | None = None
    deleted_at: datetime | None = None

    created_at: datetime

    model_config = {"from_attributes": True}


# ── LLM 추출 결과 ──
# completed.vouchers 의 형태는 runtime/voucher_document(processing_spec §6)가 정의하는
# 리치 JSON 스키마이며 이 모듈의 Pydantic 모델로 강제하지 않는다. 핸들러는 dict 로
# 전달하고(VoucherExtractionDetail.candidates: list[dict]), 화면이 편집해 confirm 으로
# 평탄화한다. (구 ExtractedField/ExtractedVoucher/ExtractedForm 은 미사용 → 제거)


# ── Voucher Extraction (업로드 → 추출 → 확정) ──


class ExtractionAcceptedResponse(BaseModel):
    # 업로드(추출 시작) 접수 응답 (비동기) — 실제 작업은 워커가 진행.
    #
    # 프론트는 voucher_extractions.status 폴링으로 completed/failed 감지.

    id: str
    status: str = Field(description="요청 직후 상태 (보통 'processing')")
    message: str = Field(default="", description="사용자에게 보여줄 안내")


class VoucherExtractionDocumentItem(BaseModel):
    id: str
    name: str
    file_type: str = Field(description="확장자 (pdf·hwpx·md ...)")
    url: str | None = Field(
        default=None, description="다운로드용 presigned URL (1h)"
    )


class VoucherExtractionSummary(BaseModel):
    id: str
    status: str
    name: str | None = Field(
        default=None,
        description="대표 원본 문서명 (global_documents.name) — 없으면 None",
    )
    type: str | None = None
    document_count: int = 0
    candidate_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoucherExtractionDetail(BaseModel):
    id: str
    status: str
    type: str | None = None
    source_url: str | None = None

    source_documents: list[VoucherExtractionDocumentItem] = Field(
        default_factory=list,
        description="입력 원본 문서 (업로드 원본: pdf·hwpx 등)",
    )
    artifact_documents: list[VoucherExtractionDocumentItem] = Field(
        default_factory=list,
        description="산출/가공 문서 (가공 md, 제출용 서식 png 등)",
    )
    meta: dict = Field(
        default_factory=dict,
        description=(
            "completed.meta — 문서 단위 공통(전 후보 공유): "
            "{organization, year, usage_period, application_period, "
            "application_method, contact}. 각 값 = 셀 {value, page, quote, quote_pdf, match} | null."
        ),
    )
    candidates: list[dict] = Field(
        default_factory=list,
        description=(
            "completed.vouchers — 리치 스키마 각 항목 "
            "{no, name, code, span:[p-AAA,p-BBB], fields:{12키: 셀|배열|하위객체, "
            "값 노드 {value, page, quote, quote_pdf, match}}}. 화면이 편집해 confirm 으로 평탄화."
        ),
    )

    forms: list[dict] = Field(
        default_factory=list,
        description=(
            "completed.forms — 서식으로 판정된 페이지 "
            "{page: 'p-NNN', title, kind, global_document_id}. "
            "바우처 span 에 드는 것이 그 바우처의 서식."
        ),
    )

    progress: dict | None = Field(
        default=None,
        description="processing 중 진행 단계 {stage: transcribe|extract|finalize}. 완료 시 무시",
    )

    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    latency_ms: int | None = Field(
        default=None,
        description="completed_at − started_at (둘 다 있을 때만)",
    )
    failed: str | None = Field(default=None, description="실패 사유")

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class VoucherExtractionListResponse(BaseModel):
    items: list[VoucherExtractionSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[VoucherExtractionSummary],
        total: int,
        page: int,
        size: int,
    ) -> "VoucherExtractionListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── Confirm (편집된 voucher payload → 카탈로그 승격) ──


class LayoutSpanItem(BaseModel):
    name: str = Field(..., max_length=255)
    code: str | None = Field(default=None, max_length=20)
    start_page: int = Field(..., ge=1)
    end_page: int = Field(..., ge=1)

    @field_validator("end_page")
    @classmethod
    def _check_span(cls, v: int, info) -> int:
        start = info.data.get("start_page")
        if start is not None and v < start:
            raise ValueError("end_page 가 start_page 보다 앞입니다")
        return v


class LayoutFormItem(BaseModel):
    # 서식 한 단위 — 여러 장짜리 문서면 start~end 가 그 구간
    title: str = Field(default="", max_length=255)
    kind: str = Field(default="기타", max_length=30)
    scope: str = Field(default="unknown", description="소속 (voucher | common | unknown)")
    voucher_names: list[str] = Field(default_factory=list)
    start_page: int = Field(..., ge=1)
    end_page: int = Field(..., ge=1)

    @field_validator("end_page")
    @classmethod
    def _check_span(cls, v: int, info) -> int:
        start = info.data.get("start_page")
        if start is not None and v < start:
            raise ValueError("end_page 가 start_page 보다 앞입니다")
        return v


class ConfirmLayoutRequest(BaseModel):
    spans: list[LayoutSpanItem]
    forms: list[LayoutFormItem] = Field(default_factory=list)


class ConfirmVoucherDocumentLink(BaseModel):
    """확정 바우처에 붙일 문서 하나 — 원본 구간·그 구간의 서식 페이지."""

    global_document_id: str
    page_range: tuple[int, int] | None = None

    @field_validator("page_range")
    @classmethod
    def _check_range(
        cls, v: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        return _validate_page_range(v)


class ConfirmExtractionVoucherItem(BaseModel):
    name: str = Field(..., max_length=255)
    program_name: str = Field(..., max_length=255)
    program_organization: str = Field(..., max_length=255)
    program_year: int = Field(..., ge=1900, le=2999)

    usage_start_date: date | None = None
    usage_end_date: date | None = None
    application_method: str | None = None
    application_start_date: date | None = None
    application_end_date: date | None = None

    support_amount: dict | None = None
    support_scope: str | None = None
    support_target: str | None = None
    contact: str | None = None
    eligibility: dict | None = None
    # 추출 정규화 레코드(§1~§10) — 무손실 관통, 카탈로그 record 컬럼에 저장
    record: dict | None = None

    page_range: tuple[int, int] | None = None

    # 이 바우처에 붙일 문서 — 화면이 span 으로 골라 보낸다(원본 + 그 구간 서식).
    # None = 구 클라이언트 → 서버가 추출 문서 전량을 붙이는 종전 동작.
    documents: list[ConfirmVoucherDocumentLink] | None = None

    @field_validator("page_range")
    @classmethod
    def _check_range(
        cls, v: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        return _validate_page_range(v)


class ConfirmExtractionRequest(BaseModel):
    vouchers: list[ConfirmExtractionVoucherItem] = Field(..., min_length=1)


class ConfirmedVoucherItem(BaseModel):
    voucher_id: str
    name: str
    program_year: int
    voucher_created: bool = Field(
        description="True: 새 Voucher 생성, False: 기존 재사용"
    )
    link_created_count: int = Field(
        description="이 voucher 에 새로 생성된 voucher_documents 링크 수"
    )


class ConfirmExtractionResponse(BaseModel):
    extraction_id: str
    items: list[ConfirmedVoucherItem]
    voucher_created_count: int
    voucher_reused_count: int
    link_created_count: int
