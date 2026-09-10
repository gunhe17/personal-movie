"""병합된 markdown (페이지 마커 포함) 파싱·슬라이스.

마커는 두 형식을 모두 수용한다:
- 구형:   `<!-- p-001 -->`                       (document_to_markdown.to_markdown 출력)
- spec형: `<!-- ═══════════ p-001 ═══════════ -->` (lab 검증 파이프라인 표기)

LLM 입력으로 재조립할 때는 항상 spec 형식으로 방출한다 — S2a/S2b 프롬프트가
`<!-- ═══ p-NNN ═══ -->` 경계를 전제로 검증되었기 때문.
"""
from __future__ import annotations

import re

from app.runtime.voucher_document.processing_spec import PAGE_MARKER_FMT

# 페이지 경계 마커 — `═` 장식 유무 모두 매칭
_MARKER_RE = re.compile(r"<!--\s*═*\s*p-(\d+)\s*═*\s*-->")

_PAGE_ID_RE = re.compile(r"p-(\d+)", re.IGNORECASE)


def page_num(page_id: str | None) -> int | None:
    """"p-031" → 31. 해석 불가면 None."""
    if not isinstance(page_id, str):
        return None
    m = _PAGE_ID_RE.search(page_id)
    if not m:
        return None
    n = int(m.group(1))
    return n if n > 0 else None


def page_id(num: int) -> str:
    """31 → "p-031" (zero-pad 3자리)."""
    return f"p-{num:03d}"


def load_pages_from_markdown(merged_md: str) -> dict[int, str]:
    """병합 markdown → {page_num(int): page_markdown(str)} 분리."""
    markers = list(_MARKER_RE.finditer(merged_md))
    pages: dict[int, str] = {}
    for i, m in enumerate(markers):
        num = int(m.group(1))
        start = m.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(merged_md)
        pages[num] = merged_md[start:end].strip()
    return pages


def pages_markdown(pages: dict[int, str], start: int, end: int) -> str:
    """start~end 범위 페이지를 spec 마커와 함께 결합 (LLM 입력용)."""
    parts: list[str] = []
    for num in range(start, end + 1):
        if num in pages:
            marker = PAGE_MARKER_FMT.format(page=page_id(num))
            parts.append(f"{marker}\n{pages[num]}")
    return "\n\n".join(parts)


def full_markdown(pages: dict[int, str]) -> str:
    """전체 페이지를 spec 마커와 함께 결합 (S2a 입력용)."""
    if not pages:
        return ""
    return pages_markdown(pages, min(pages), max(pages))
