# Admin Form Extraction 스키마 — 서식 → form_template 추출.
#
# voucher 추출 스키마의 평행본. 차이:
# - 입력은 서식 1장 (업로드 또는 기존 global_document + page_range).
# - 산출은 PNG 1장 + FormSchema draft 1개 → 확정 시 form_template 1개(1:1).
import math
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


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


# ── 시작(start) 요청/응답 ──


class FormExtractionFromDocumentRequest(BaseModel):
    source_document_id: str = Field(..., description="입력 원본 global_document id")
    name: str = Field(..., max_length=100, description="만들 form_template 기본 이름")
    center_id: str | None = Field(
        default=None, description="귀속 센터 (NULL = 시스템 템플릿)"
    )
    page_range: tuple[int, int] | None = Field(
        default=None,
        description="다중 페이지 PDF 일 때 서식 위치 (단일 페이지만; low==high)",
    )

    @field_validator("page_range")
    @classmethod
    def _check_range(
        cls, v: tuple[int, int] | None
    ) -> tuple[int, int] | None:
        return _validate_page_range(v)


class FormExtractionAcceptedResponse(BaseModel):
    # 시작(추출) 접수 응답 (비동기) — 실제 작업은 워커가 진행.
    #
    # 프론트는 form_extractions.status 폴링으로 completed/failed 감지.

    id: str
    status: str = Field(description="요청 직후 상태 (보통 'processing')")
    message: str = Field(default="", description="사용자에게 보여줄 안내")


# ── 목록/상세 ──


class FormExtractionDocumentItem(BaseModel):
    id: str
    name: str
    file_type: str = Field(description="확장자 (pdf·png ...)")


class FormExtractionSummary(BaseModel):
    id: str
    status: str
    name: str
    center_id: str | None = None
    source_document_id: str
    page: int | None = Field(
        default=None, description="page_range 시작 쪽 — 원본 문서에서 이 서식이 있던 자리"
    )
    has_image: bool = Field(
        default=False, description="가공 PNG(image_document_id) 생성 여부"
    )
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FormExtractionDetail(BaseModel):
    id: str
    status: str
    name: str
    center_id: str | None = None

    source_document: FormExtractionDocumentItem | None = None
    image_document: FormExtractionDocumentItem | None = None
    schema_: dict[str, Any] | None = Field(
        default=None,
        alias="schema",
        description="completed — FormSchema draft {pages, fields, elements}",
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

    model_config = {"from_attributes": True, "populate_by_name": True}


class FormExtractionListResponse(BaseModel):
    items: list[FormExtractionSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[FormExtractionSummary],
        total: int,
        page: int,
        size: int,
    ) -> "FormExtractionListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ── Confirm (편집된 FormSchema → form_template draft) ──


class ConfirmFormExtractionRequest(BaseModel):
    # POST /form-extractions/{id}/confirm body — 화면 편집 결과.
    #
    # name/schema 모두 화면에서 정정된 최종본. 서버는 결과만 신뢰한다.

    name: str = Field(..., max_length=100, description="form_template 이름")
    schema_: dict[str, Any] = Field(
        ..., alias="schema", description="편집된 FormSchema (pages+fields+elements)"
    )
    # 이 서식을 쓰는 바우처들 — 영역 확정 화면의 소속 선택이 정본, 화면이 id 로 해소해 보낸다.
    # 빈 배열 = 어느 바우처에도 붙이지 않음(의도된 선택).
    voucher_ids: list[str] = Field(default_factory=list)
    kind: str = Field(default="기타", max_length=20)

    model_config = {"populate_by_name": True}


class ConfirmFormExtractionResponse(BaseModel):
    extraction_id: str
    template_id: str
    name: str
    version: int
    status: str
    created: bool = Field(
        description="True: 새 템플릿 row(v1 또는 버전 증가) / False: 기존 draft 덮어쓰기"
    )

