"""markdown → voucher 가공(S2a 분리 + S2b 12필드) 데이터 dataclass."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class VoucherSpan:
    """S2a 산출 — 개별 바우처 1건의 식별자와 페이지 범위.

    page 값은 통합 MD 마커 표기 그대로 "p-NNN" 문자열.
    """

    no: str            # 목차 번호 (예: "1", "2-1")
    name: str          # 사업명
    code: str | None   # 6자리 사업코드
    start_page: str    # "p-NNN"
    end_page: str      # "p-NNN"
    indicators: list[str] = field(default_factory=list)  # ["①","②","③"]
    rationale: str = ""


@dataclass
class CommonSpan:
    label: str
    start_page: str
    end_page: str
