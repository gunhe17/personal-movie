"""표 페이지 판정 T(p) — 괘선(PDF 의 선)만으로, LLM·휴리스틱 없음."""
from __future__ import annotations

import io

import fitz

from app.runtime.voucher_document.document_to_list.candidates import ruled_table_pages


def _pdf() -> bytes:
    doc = fitz.open()
    p1 = doc.new_page(width=400, height=500)                       # 산문
    p1.insert_text((40, 60), "plain prose page without any table", fontsize=11)
    p2 = doc.new_page(width=400, height=500)                       # 3x3 표 (괘선)
    for k in range(4):
        p2.draw_line((40, 60 + k * 40), (340, 60 + k * 40), width=1)
        p2.draw_line((40 + k * 100, 60), (40 + k * 100, 180), width=1)
    p3 = doc.new_page(width=400, height=500)                       # 프레임(박스) 하나
    p3.draw_rect(fitz.Rect(40, 60, 340, 200), width=1)
    buf = io.BytesIO(); doc.save(buf); doc.close()
    return buf.getvalue()


def test_ruled_pages_detects_table_and_frame_not_prose():
    assert ruled_table_pages(_pdf()) == {2, 3}
