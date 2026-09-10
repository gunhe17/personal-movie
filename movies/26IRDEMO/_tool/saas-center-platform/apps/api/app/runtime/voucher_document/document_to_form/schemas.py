from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FormPage:
    page: str  # "p-NNN"
    title: str = ""  # 양식 제목 (없으면 "")
    kind: str = ""  # 신청서|동의서|...|기타 (processing_spec.FORM_KINDS)
    scope: str = "unknown"  # voucher|common|unknown (processing_spec.FORM_SCOPES)
    voucher_name: str = ""  # scope=voucher 일 때 페이지에 적힌 사업명
    reason: str = ""  # 한 줄 근거
    schema: dict | None = None  # FormSchema dict (추출 후)


@dataclass
class FormPageFailure:
    page: str
    error: str


@dataclass
class FormDetectionResult:
    """서식 페이지 판정만 (스키마 없음)."""

    form_pages: list[FormPage] = field(default_factory=list)
    pages_judged: int = 0
    failures: list[FormPageFailure] = field(default_factory=list)

    cost_usd: float = 0.0
    latency_ms: int = 0  # 호출 합계 (wall clock 아님)
    input_tokens: int = 0
    output_tokens: int = 0

    model: str = ""
