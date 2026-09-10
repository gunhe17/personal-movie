"""서식 입력 → 쪽별 PNG 렌더.

입력은 PDF 또는 이미지(png/jpg/webp). 산출은 **쪽마다 (PNG, w, h)** 목록이다.
여러 장짜리 서식은 한 템플릿의 여러 페이지가 된다 — 쪽마다 나누면 같은 서식이
템플릿 여러 개로 갈린다(실측: 추천서 p.9·소견서 p.10 이 별개 템플릿이 됨).
다중 프레임 이미지(애니메이션)는 여전히 미지원.
"""
from __future__ import annotations

import io

from app.core.exceptions import InvalidOperationException
from app.runtime.voucher_document.common.pdf_processor import (
    PdfProcessor,
)

_IMAGE_EXTS = {"png", "jpg", "jpeg", "webp"}


def render_page_pngs(
    *,
    data: bytes,
    file_type: str,
    pages: list[int] | None = None,
    dpi: int | None = None,
) -> list[tuple[int, bytes, int, int]]:
    """[(원본 쪽번호, PNG, w, h)] — pages 미지정이면 문서 전체."""
    ft = (file_type or "").lower()

    if ft == "pdf":
        return _render_pdf_pages(data, pages, dpi)
    if ft in _IMAGE_EXTS:
        png, w, h = _render_image(data)
        return [(1, png, w, h)]

    raise InvalidOperationException(
        f"지원하지 않는 서식 형식입니다(PDF/PNG/JPG만): {file_type}"
    )


def _render_pdf_pages(
    data: bytes,
    pages: list[int] | None,
    dpi: int | None = None,
) -> list[tuple[int, bytes, int, int]]:
    with (PdfProcessor(data, dpi=dpi) if dpi else PdfProcessor(data)) as proc:
        count = proc.page_count
        targets = pages if pages else list(range(1, count + 1))
        for p in targets:
            if p < 1 or p > count:
                raise InvalidOperationException(
                    f"page_range 페이지({p})가 문서 범위(1..{count})를 벗어났습니다"
                )
        out = []
        for p in targets:
            png = proc.render_page_png(p)
            w, h = _png_size(png)
            out.append((p, png, w, h))
    return out


def _render_image(data: bytes) -> tuple[bytes, int, int]:
    from PIL import Image

    with Image.open(io.BytesIO(data)) as im:
        if getattr(im, "n_frames", 1) > 1:
            raise InvalidOperationException(
                "다중 프레임 이미지 서식은 아직 미지원입니다(애니메이션/멀티페이지)"
            )
        rgb = im.convert("RGB")
        w, h = rgb.width, rgb.height
        buf = io.BytesIO()
        rgb.save(buf, format="PNG")
    return buf.getvalue(), w, h


def _png_size(png: bytes) -> tuple[int, int]:
    from PIL import Image

    with Image.open(io.BytesIO(png)) as im:
        return im.width, im.height
