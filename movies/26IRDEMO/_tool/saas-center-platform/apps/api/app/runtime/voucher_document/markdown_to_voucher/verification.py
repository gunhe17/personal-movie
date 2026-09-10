"""verify — 셀 귀속 검증 (결정론 · LLM 아님). lab-voucher 격리본 verify() 이식 (E17 육안 95.2% 실증).

검증 소스 = PDF 원문 텍스트층 (뷰어가 검색하는 그것 — S2c 철학). 가공 MD 기준 검증은 표 붕괴
페이지에서 위음성(43/47 실측)을 내므로 쓰지 않는다.

셀 = {value, page("p-NNN"), quote} — capture/fields 어느 컨테이너든 동일. 배열 축은 원소들의
page 를 수집해 셀처럼 검사한다. 값 토큰(한글·영숫자 2자↑) 중 need=min(3, |토큰|/2) 이상이
인용 페이지에 실재하면 "확인". 실패 시 구간 전 페이지 탐색(페이지 스냅)으로 교정.

등급: 확인 / 확인(스냅) / 확인(구간) / 확인(공용) / 기권 / 미확인 / 출처불량 / 확인불가 /
      미검증(스캔) / 형식불량.  REPAIR_GRADES 가 repair 스테이지의 분쟁 집합.
"""
from __future__ import annotations

import json
import re

import fitz  # PyMuPDF

from app.runtime.voucher_document.common.page_markdown import page_num

REPAIR_GRADES = ("미확인", "출처불량", "형식불량")

_NORM = re.compile(r"[\s,·･ㆍ()（）%원~∼～「」『』:：/／\-–\.|'’‘\"]")
_TOKEN = re.compile(r"[가-힣A-Za-z0-9]{2,}")


def norm(s) -> str:
    return _NORM.sub("", str(s))


def page_texts(pdf_bytes: bytes) -> dict[int, str]:
    """PDF → {1기준 페이지: 정규화 텍스트층}."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return {i + 1: norm(doc[i].get_text()) for i in range(doc.page_count)}
    finally:
        doc.close()


def _span(lo, hi) -> tuple[int, int]:
    """span 표기 관용 — 정수 또는 "p-NNN"."""
    a = lo if isinstance(lo, int) else (page_num(lo) or 0)
    b = hi if isinstance(hi, int) else (page_num(hi) or 0)
    return a, b


def verify_cells(
    fields: dict | None,
    texts: dict[int, str],
    lo,
    hi,
    scanned: bool = False,
) -> dict[str, str]:
    """{필드: 셀|배열} → {필드: 등급}. 셀의 page 는 스냅 시 in-place 교정(page_snapped=True)."""
    lo, hi = _span(lo, hi)
    pages = {f"p-{i:03d}": texts.get(i, "") for i in range(lo, hi + 1)}
    out: dict[str, str] = {}
    for f, node in (fields or {}).items():
        if isinstance(node, list):                    # 구조 축(배열) — 원소 page 수집해 셀처럼
            node = {"value": node,
                    "page": ", ".join(sorted({str(e.get("page")) for e in node
                                              if isinstance(e, dict) and e.get("page")})[:3]),
                    "quote": ""}
        if node is None:                              # 구조 축 미추출(팩 배열·객체 축의 null) = 기권
            out[f] = "기권"
            continue
        if not isinstance(node, dict):
            out[f] = "형식불량"
            continue
        v = node.get("value", {k: x for k, x in node.items() if k not in ("page", "quote")} or None)
        if isinstance(v, (dict, list)) and not v:
            v = None
        pg = str(node.get("page") or "")
        if v is None:
            out[f] = "기권"
            continue
        if scanned:
            out[f] = "미검증(스캔)"
            continue
        if node.get("inherited"):                     # 공용 상속 — 원 페이지(구간 밖 가능) 대조
            n0 = page_num(pg)
            tk0 = set(_TOKEN.findall(str(v).replace("(문서 공통)", "")))
            need0 = max(1, min(3, len(tk0) // 2))
            hit = n0 in texts and sum(1 for t in tk0 if norm(t) in texts[n0]) >= need0
            out[f] = "확인(공용)" if hit else "미확인"
            continue
        pgs = re.findall(r"p-\d+", pg)
        if pgs:
            node["page"] = ", ".join(pgs)
        tk = set(_TOKEN.findall(json.dumps(v, ensure_ascii=False)))
        need = max(1, min(3, len(tk) // 2))

        def hits(p: str) -> int:
            return sum(1 for t in tk if norm(t) in pages.get(p, ""))

        bad_pg = not pgs or not all(lo <= int(p.split("-")[1]) <= hi for p in pgs)
        if not tk:
            out[f] = "확인불가" if not bad_pg else "출처불량"
        elif not bad_pg and any(hits(p) >= need for p in pgs):
            out[f] = "확인"
        else:                                         # 페이지 스냅 (repair 1호): 구간 전 페이지 탐색
            scored = sorted(((hits(p), p) for p in pages), reverse=True)
            if scored and scored[0][0] >= need:
                uniq = len(scored) < 2 or scored[0][0] > scored[1][0]
                node["page"] = scored[0][1]
                node["page_snapped"] = True
                out[f] = "확인(스냅)" if uniq else "확인(구간)"
            else:
                out[f] = "출처불량" if bad_pg else "미확인"
    return out


def verify_vouchers(vouchers: list[dict], pdf_bytes: bytes, scanned: bool = False) -> dict[str, int]:
    """completed.vouchers 전체에 verify 부여(in-place: v["verify"]). → 등급 집계."""
    texts = page_texts(pdf_bytes)
    tally: dict[str, int] = {}
    for v in vouchers:
        fields = v.get("fields") if isinstance(v.get("fields"), dict) else v.get("capture")
        span = v.get("span") or [0, 0]
        v["verify"] = verify_cells(fields, texts, span[0], span[1], scanned=scanned)
        for g in v["verify"].values():
            tally[g] = tally.get(g, 0) + 1
    return tally
