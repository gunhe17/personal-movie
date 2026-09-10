"""PyMuPDF 기반 PDF 처리 — page 단위 PNG 렌더.

poppler 시스템 의존성 없이 fitz(PyMuPDF) 하나로 렌더한다.
"""
from __future__ import annotations

import fitz  # PyMuPDF

# 렌더 해상도 — 스크립트의 pdf2image 기본값과 유사
DEFAULT_DPI = 150


class PdfProcessor:
    """PDF 페이지별 PNG 렌더 헬퍼.

    한 PDF에 대해 인스턴스를 만들면 fitz.Document를 오픈해 두고 여러 페이지를
    렌더한다. with 문 또는 close() 권장.
    """

    def __init__(
        self,
        pdf_bytes: bytes,
        *,
        dpi: int = DEFAULT_DPI,
    ):
        self._doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        self._dpi = dpi

    @property
    def page_count(self) -> int:
        return self._doc.page_count

    def render_page_png(self, page_num: int) -> bytes:
        if page_num < 1 or page_num > self._doc.page_count:
            raise IndexError(
                f"page_num={page_num} out of range (1..{self._doc.page_count})"
            )
        return self._render_png(self._doc[page_num - 1])

    def _render_png(self, page) -> bytes:
        pix = page.get_pixmap(dpi=self._dpi)
        return pix.tobytes("png")

    def close(self) -> None:
        self._doc.close()

    def __enter__(self) -> "PdfProcessor":
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ) -> None:
        self.close()
