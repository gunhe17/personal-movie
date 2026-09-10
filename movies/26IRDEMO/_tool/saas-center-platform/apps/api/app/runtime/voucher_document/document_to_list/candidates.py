"""결정론 해부 — pdf-inspector(firecrawl, 1.17.0 동결) + PyMuPDF. LLM 없음.

- classify_pdf_bytes: text_based / scanned 판별 (route 분기)
- text_pages_markdown: 텍스트층 페이지 MD + 침묵손실 폴백 v2 (lab 실측: 5,012장 중 73장 —
  점선 목차가 needs_ocr 오판을 유발해 페이지가 빈 채 나오는 상류 결함 #342·#385을 독립 엔진
  (PyMuPDF) 대조로 구제)
- ruled_table_pages: 표 페이지 T(p) = 렌더 이미지에 괘선 교차 구조(표·프레임) ≥1 —
  S1 의 region_segment(순수 CV) 재사용. pi.pages_with_tables 는 감사 A1 에서 누락·오탐
  양방향(GT span 40% 에서 진짜 표 누락)이라 폐기. 0.04s/p.
- title_candidates: 폰트 후보 규칙 v3' — 줄 폰트 ≥ 본문 중앙값×1.15 ∧ 한글 ≥4자, 같은 크기가
  2~60줄인 군집만(본문 강조 수백 줄·표지 1줄 배제). 15문서 실측 기지 시작페이지 누락 0.
"""
from __future__ import annotations

import re
import tempfile
from collections import Counter
from contextlib import contextmanager

import fitz
import numpy as np
import pdf_inspector as pi

from app.runtime.voucher_document.document_to_markdown.region_segment import segment

_RULE_DPI = 100     # 괘선 검출엔 충분(150dpi 와 동일 판정 실측), 렌더 비용 절반


@contextmanager
def _tmp_pdf(pdf_bytes: bytes):
    """pdf-inspector 는 경로 입력 — 임시 파일로 우회."""
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf_bytes)
        f.flush()
        yield f.name


def classify_pdf_bytes(pdf_bytes: bytes) -> tuple[str, int]:
    """→ (pdf_type, page_count). pdf_type ∈ {"text_based", "scanned", ...}."""
    with _tmp_pdf(pdf_bytes) as path:
        cls = pi.classify_pdf(path)
    return cls.pdf_type, cls.page_count


def text_pages_markdown(pdf_bytes: bytes) -> tuple[dict[int, str], set[int]]:
    """→ ({1기준 페이지: md}, 표 페이지 집합). 침묵손실 폴백 v2 포함."""
    with _tmp_pdf(pdf_bytes) as path:
        res = pi.extract_pages_markdown(path)
    pages_md = {p.page + 1: p.markdown for p in res.pages}   # 0기준→1기준
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for i in range(doc.page_count):
            got = len(re.sub(r"\s", "", pages_md.get(i + 1, "")))
            alt = doc[i].get_text()
            ref = len(re.sub(r"\s", "", alt))
            if (got < 30 and ref >= 30) or (ref >= 60 and got < ref * 0.5):
                pages_md[i + 1] = alt
        table_pages = {i + 1 for i in range(doc.page_count) if _is_ruled(doc[i])}
    finally:
        doc.close()
    return pages_md, table_pages


def _is_ruled(page: fitz.Page) -> bool:
    """T(p): 괘선 교차 구조(표·프레임)가 하나라도 있으면 표 페이지 — 우리 판단 없음, PDF 의 선.
    독립 검출기 2개의 합집합(재현율 우선): 렌더 이미지 괘선(region_segment) ∪ 벡터 표(PyMuPDF find_tables).
    감사 A1: 단독으로는 서로 놓치는 페이지가 있어(각 30~40p/문서) 합집합으로 닫는다."""
    pm = page.get_pixmap(dpi=_RULE_DPI, colorspace=fitz.csGRAY)
    gray = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width)
    seg = segment(gray)
    if seg["tables"] or seg["frames"]:
        return True
    return bool(page.find_tables().tables)


def ruled_table_pages(pdf_bytes: bytes) -> set[int]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return {i + 1 for i in range(doc.page_count) if _is_ruled(doc[i])}
    finally:
        doc.close()


def title_candidates(pdf_bytes: bytes) -> list[str]:
    """제목 후보 줄 목록 — "p{pg:>3} {pt:5.1f}pt  {txt[:70]}" (lab split 입력 형식 verbatim)."""
    with _tmp_pdf(pdf_bytes) as path:
        items = pi.extract_text_with_positions(path)
    sizes: list[int] = []
    for it in items:
        sizes += [round(it.font_size)] * len(it.text.strip())
    if not sizes:
        return []
    med = sorted(sizes)[len(sizes) // 2]
    by: dict[tuple[int, int], list] = {}
    for it in items:
        by.setdefault((it.page, round(it.y)), []).append(it)
    cands: list[tuple[int, int, str]] = []
    for (pg, _y), its in sorted(by.items()):
        its.sort(key=lambda i: i.x)
        txt = " ".join(i.text for i in its).strip()
        mx = max(i.font_size for i in its)
        if mx >= med * 1.15 and len(re.findall(r"[가-힣]", txt)) >= 4:
            cands.append((pg, round(mx), f"p{pg:>3} {mx:5.1f}pt  {txt[:70]}"))
    cl = Counter(pt for _, pt, _ in cands)
    ok = {pt for pt, n in cl.items() if 2 <= n <= 60}
    return [c for _, pt, c in sorted(cands) if pt in ok]
