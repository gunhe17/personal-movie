"""document → 바우처 목록 (lab voucher-list-extraction 이식, E20: F1 0.997 · 누락 0).

    PDF ─ candidates(결정론: 분류·텍스트층 md·폰트 후보 v3')
        ─ split(LLM K=2 합집합 + dedup + span 결정론)
        ─ toc_reconcile(목차 대사 결정론 교정 / 목차 부재 분쟁만 판정자) ─ complement(공용)

실행은 runner(`advance_route`·`advance_list`)가 소유 — 여기는 유닛 빌드·조립·결정론만.
"""
from .candidates import classify_pdf_bytes, text_pages_markdown, title_candidates
from .split import assemble_split, build_split_units
from .toc_reconcile import (
    apply_arbiter_results,
    build_arbiter_units,
    complement,
    parse_toc,
    reconcile_with_toc,
    scope_warning,
)

__all__ = [
    "classify_pdf_bytes", "text_pages_markdown", "title_candidates",
    "build_split_units", "assemble_split",
    "parse_toc", "reconcile_with_toc", "build_arbiter_units", "apply_arbiter_results",
    "complement", "scope_warning",
]
