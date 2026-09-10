"""S2c — quote 스내핑 (결정론 후처리 · LLM 아님).

S2b 의 quote 는 변환 MD 에서 뽑혀 PDF 원문과 글자가 미세하게 다를 수 있다
(가운뎃점 `･`↔`·`, 한자, 공백). 뷰어는 PDF 텍스트층을 검색해 칠하므로,
quote 를 그 페이지 실제 텍스트로 snap 한다. 각 quote 노드에
`quote_pdf`(뷰어가 검색할 PDF 교정 텍스트) + `match`("exact|snapped|none") 부여.

알고리즘 (lab step3.6 snap.py 이식, 명세 S2c):
  1. 양쪽 공백 정규화. 정규화(quote) ⊆ 정규화(page_text) → "exact".
  2. 아니면 difflib 로 quote 와 가장 유사한 연속 구간(매칭 블록 처음~끝 정렬).
     유사도 ≥ SNAP_THRESHOLD(0.85) → 그 PDF 실제 텍스트로 교체 "snapped". 아니면 "none".

페이지 텍스트 소스: 명세는 poppler `pdftotext -layout` 이지만 런타임은 PyMuPDF
텍스트층(`page.get_text()`)을 쓴다 — 뷰어가 검색하는 대상이 곧 PDF 텍스트층이므로
스냅 기준으로 동일하거나 더 적합하다 (poppler 시스템 의존성 추가 없음).

철학(프로젝트 원칙): LLM 은 대략의 텍스트(의미), 도구가 원문에서 정확한 구간을
찾는다. 좌표(bbox)는 LLM 이 내지 않는다 — 뷰어가 quote_pdf 로 find-highlight.
"""
from __future__ import annotations

import difflib
import re
import unicodedata
from dataclasses import dataclass

import fitz  # PyMuPDF

from app.core.logger import get_logger
from app.runtime.voucher_document.common.page_markdown import page_num
from app.runtime.voucher_document.processing_spec import SNAP_THRESHOLD

logger = get_logger(__name__)

_WS_RE = re.compile(r"\s+")
# LLM 전사(표준 Unicode)와 PDF 원본 인코딩(·U+00B7↔･U+FF65, 전각·CJK 호환형)의 체계적
# 차이를 흡수 — 안 하면 눈에 같은 글자가 코드포인트 달라 exact 실패 → difflib 오앵커 → none.
_MID_DOTS = {ord(c): "·" for c in "·･・ㆍ‧∙•"}

# walk 시 재귀 진입하지 않는 키 — quote 노드 자신의 스칼라/결과 필드
_LEAF_KEYS = ("quote", "quote_pdf", "match", "page", "value", "mark")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).translate(_MID_DOTS)
    return _WS_RE.sub(" ", s).strip()


def extract_page_texts(pdf_bytes: bytes) -> dict[str, str]:
    """PDF → {"p-NNN": 정규화된 페이지 텍스트층} (1-indexed, zero-pad 3)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return {
            f"p-{i + 1:03d}": _norm(doc[i].get_text())
            for i in range(doc.page_count)
        }
    finally:
        doc.close()


def snap_quote(quote: str, page_text: str) -> tuple[str | None, str]:
    """(quote_pdf, match) — 페이지 텍스트에서 quote 와 가장 잘 맞는 실제 구간."""
    qn = _norm(quote)
    text = page_text  # extract_page_texts 가 이미 정규화
    if not qn or not text:
        return None, "none"
    if qn in text:
        return qn, "exact"
    sm = difflib.SequenceMatcher(None, qn, text, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    if not blocks:
        return None, "none"
    start = max(0, blocks[0].b - blocks[0].a)  # 정렬된 시작
    end = blocks[-1].b + blocks[-1].size
    span = text[start:end].strip()
    if (
        span
        and difflib.SequenceMatcher(None, qn, span, autojunk=False).ratio()
        >= SNAP_THRESHOLD
    ):
        return span, "snapped"
    return None, "none"


@dataclass
class SnapStats:
    exact: int = 0
    snapped: int = 0
    none: int = 0

    @property
    def total(self) -> int:
        return self.exact + self.snapped + self.none

    @property
    def findable(self) -> int:
        return self.exact + self.snapped


def _walk(node, page_texts: dict[str, str], stats: SnapStats, page: str | None = None) -> None:
    """quote 노드에 quote_pdf·match 주입 (in-place). page 는 조상에서 상속."""
    if isinstance(node, dict):
        pg = node.get("page", page)
        if isinstance(node.get("quote"), str) and node["quote"]:
            pg_key = pg if page_num(pg) is not None else None
            quote_pdf, match = (
                snap_quote(node["quote"], page_texts.get(pg_key, ""))
                if pg_key
                else (None, "none")
            )
            node["quote_pdf"] = quote_pdf
            node["match"] = match
            setattr(stats, match, getattr(stats, match) + 1)
        for key, value in node.items():
            if key not in _LEAF_KEYS:
                _walk(value, page_texts, stats, pg)
    elif isinstance(node, list):
        for item in node:
            _walk(item, page_texts, stats, page)


def snap_meta_quotes(meta: dict, pdf_bytes: bytes) -> SnapStats:
    """문서 메타 dict 의 quote 노드를 스냅 (in-place). 바우처와 동일 규칙."""
    page_texts = extract_page_texts(pdf_bytes)
    stats = SnapStats()
    if isinstance(meta, dict):
        _walk(meta, page_texts, stats)
    if stats.total:
        logger.info(
            "quote_snapping(meta): %d quote — exact %d + snapped %d + none %d",
            stats.total, stats.exact, stats.snapped, stats.none,
        )
    return stats


def snap_voucher_quotes(
    vouchers: list[dict], pdf_bytes: bytes
) -> SnapStats:
    page_texts = extract_page_texts(pdf_bytes)
    stats = SnapStats()
    for voucher in vouchers:
        # 정본 capture 의 quote 스냅 (레거시 record 가 있으면 함께 스냅).
        for key in ("fields", "capture", "record"):
            node = voucher.get(key)
            if isinstance(node, dict):
                _walk(node, page_texts, stats)
    if stats.total:
        logger.info(
            "quote_snapping: %d quote — exact %d + snapped %d + none %d "
            "→ findable %.1f%%",
            stats.total, stats.exact, stats.snapped, stats.none,
            stats.findable / stats.total * 100,
        )
    return stats
