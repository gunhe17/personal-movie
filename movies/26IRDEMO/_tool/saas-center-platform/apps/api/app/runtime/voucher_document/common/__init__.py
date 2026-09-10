"""voucher_document 공용 — 문서 렌더·페이지 마크다운 헬퍼.

입력이 PDF/hwpx/image 로 늘어나도 세 변환 모듈이 공유하는 표면.
현재 렌더는 PdfProcessor(PDF)만 구현.
"""
from .page_markdown import (
    full_markdown,
    load_pages_from_markdown,
    page_id,
    page_num,
    pages_markdown,
)
from .pdf_processor import PdfProcessor

__all__ = [
    "PdfProcessor",
    "full_markdown",
    "load_pages_from_markdown",
    "page_id",
    "page_num",
    "pages_markdown",
]
