"""field — 바우처당 9그룹 필드 추출 (lab voucher-field-extraction 팩 v4.1, E36~E39 실증).

입력은 이미지 전용(구간 전 쪽 150dpi, 좌상단 p-NNN 스탬프 — E30: 값 동등·근거 정확일치 ↑·출처불량 0).
구간이 이미지 캡(12장)을 넘거나 스캔 경로면 하이브리드 유지(md 슬라이스 + 표 페이지 이미지 — P9 tx 전사 병용).
필드 정의 = FIELD_PACK v4.1(21축, 의도 서술형) + FIELD_FEWSHOT(실측 오답 ○/✗ 대조쌍 — E38-b).

조립 결정론: 스키마 클램프(모델 오타 키 차단) · 누락 키 명시적 null(기권) · "null" 문자열 정규화.
실행은 runner `advance_field`가 소유.
"""
from __future__ import annotations

import base64

import fitz

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.page_markdown import page_num, pages_markdown
from app.runtime.voucher_document.processing_spec import (
    FIELD_EXTRACT_SYSTEM_HYBRID,
    FIELD_EXTRACT_SYSTEM_IMAGE,
    FIELD_FEWSHOT,
    FIELD_MAX_TOKENS,
    FIELD_PACK,
    MODEL_LIST,
)

MAX_IMAGES = 12
_NULL_STRINGS = ("null", "none")
# 9그룹 분할 (lab E38): 베끼기(안정 축)는 묶고, 재구성·오류 이력 축은 따로 — 전 그룹 병렬.
FIELD_GROUPS: dict[str, list[str]] = {
    "g1": ["목적", "법적근거", "소득기준", "연령기준", "우선순위", "제외"],
    "g2": ["욕구기준"],
    "g3": ["지역"],
    "g4": ["금액"],
    "g5": ["서비스", "운영규칙"],
    "g6": ["집단규모", "제공인력"],
    "g7": ["절차", "신청"],
    "g8": ["처리통지", "이의신청", "중복금지"],
    "g9": ["신고의무", "중지상실", "환수"],
}


def stamped_page_png(doc: fitz.Document, i: int) -> bytes:
    """페이지 렌더 + 좌상단 p-NNN 스탬프 (공용 PdfProcessor 는 form 런타임도 쓰므로 여기 국소화)."""
    pg = doc[i - 1]
    pg.draw_rect(fitz.Rect(0, 0, 86, 22), fill=(1, 1, 1))
    pg.insert_text((5, 16), f"p-{i:03d}", fontsize=12)
    return pg.get_pixmap(dpi=150).tobytes("png")


def span_ints(span) -> tuple[int, int]:
    """spans 인계 표기 관용 — VoucherSpan("p-NNN") 또는 정수."""
    lo, hi = span[0], span[1]
    return (lo if isinstance(lo, int) else (page_num(lo) or 0),
            hi if isinstance(hi, int) else (page_num(hi) or 0))


def split_span_pages(lo: int, hi: int, table_pages: set[int] | None, cap: int = MAX_IMAGES) -> tuple[list[int], list[int]]:
    """페이지 배정 규칙 (결정론): |S|≤cap → 전 쪽 이미지, 전사 없음.
    |S|>cap → 표 페이지 T 를 페이지 순으로 cap 장까지 이미지(IMG), 넘친 표 페이지는 전사(GEM).
    table_pages=None(스캔 경로: 전 페이지가 이미 전사됨) → 전 쪽 후보 cap 장, GEM 없음."""
    span = list(range(lo, hi + 1))
    if table_pages is None:
        return span[:cap], []
    if len(span) <= cap:
        return span, []
    t = [p for p in span if p in table_pages]
    return t[:cap], t[cap:]


def overflow_pages(spans: list[dict], table_pages: set[int] | None, cap: int = MAX_IMAGES) -> list[int]:
    """전 바우처의 GEM 합집합 (tx 스테이지 입력)."""
    out: set[int] = set()
    if table_pages is None:
        return []
    for s in spans:
        lo, hi = span_ints((s["start_page"], s["end_page"]))
        out.update(split_span_pages(lo, hi, table_pages, cap)[1])
    return sorted(out)


def _examples_block(keys: list[str]) -> str:
    """퓨샷 블록 — 실측 오답 기반 ○/✗ 대조쌍 (E38-b: 오분류 예시는 배제 규칙이라 전부 포함)."""
    lines = []
    for k in keys:
        b = FIELD_FEWSHOT.get(k)
        if not b:
            continue
        ex = [f"  ○ {s}" for s in b.get("적합", [])] + [f"  ✗ {s}" for s in b.get("오분류", [])]
        if ex:
            lines.append(f"[{k} 판별 예]\n" + "\n".join(ex))
    return ("\n판별 예 (○=이 칸에 담는다, ✗=이 칸이 아니다 — 다른 문서의 실제 사례):\n"
            + "\n".join(lines) + "\n") if lines else ""


def _system_prompt(keys: list[str], image_only: bool) -> str:
    fields, cells = FIELD_PACK["fields"], set(FIELD_PACK["cell_fields"])
    fielddef = "\n".join(f'- "{k}": {fields[k]}' for k in keys)
    shape = ",".join(f'"{k}":{{"value","page","quote"}}' if k in cells else f'"{k}":…' for k in keys)
    template = FIELD_EXTRACT_SYSTEM_IMAGE if image_only else FIELD_EXTRACT_SYSTEM_HYBRID
    return template.format(perspective=FIELD_PACK["관점"], fielddef=fielddef,
                           examples=_examples_block(keys), shape=shape)


def build_field_units(
    *,
    pdf_bytes: bytes,
    pages: dict[int, str],
    spans: list[dict],
    table_pages: set[int] | None,
    model: str = MODEL_LIST,
) -> list[BatchUnit]:
    """바우처당 그룹 수(9) 유닛 (key = "{index}:{group}").

    텍스트 경로 & 구간 ≤캡 → 이미지 전용(전 쪽 스탬프 이미지, 텍스트 없음 — E30 채택).
    구간 >캡 또는 스캔 경로 → 하이브리드(md 슬라이스 + 이미지 캡 — tx/S1 전사 텍스트 병용)."""
    systems_img = {g: _system_prompt(keys, True) for g, keys in FIELD_GROUPS.items()}
    systems_hyb = {g: _system_prompt(keys, False) for g, keys in FIELD_GROUPS.items()}
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        units: list[BatchUnit] = []
        for i, s in enumerate(spans):
            lo, hi = span_ints((s["start_page"], s["end_page"]))
            image_only = table_pages is not None and (hi - lo + 1) <= MAX_IMAGES
            imgs = [p for p in split_span_pages(lo, hi, table_pages)[0] if 1 <= p <= doc.page_count]
            images: list[dict] = [
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,"
                 + base64.b64encode(stamped_page_png(doc, p)).decode()}}
                for p in imgs
            ]
            if image_only:
                text = {"type": "text", "text": "필드를 명세된 JSON으로 추출하라."}
            else:
                txt = pages_markdown(pages, lo, hi)
                text = {"type": "text", "text": f"<voucher_text>\n{txt}\n</voucher_text>\n필드를 명세된 JSON으로 추출하라."}
            systems = systems_img if image_only else systems_hyb
            for g in FIELD_GROUPS:
                units.append(BatchUnit(
                    key=f"{i}:{g}", model=model,
                    messages=[{"role": "system", "content": systems[g]}, {"role": "user", "content": images + [text]}],
                    max_tokens=FIELD_MAX_TOKENS, response_format={"type": "json_object"},
                    temperature=1.0, reasoning={"effort": "low"},
                ))
        return units
    finally:
        doc.close()


def normalize_fields(raw: dict | None) -> dict | None:
    """LLM 출력 → 팩 축 고정 맵. 클램프 · 누락 null · "null" 문자열 정규화."""
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    for k in FIELD_PACK["fields"]:
        node = raw.get(k)
        if k in FIELD_PACK["cell_fields"] and not isinstance(node, dict):
            node = {"value": node if node not in ("", None) else None, "page": None, "quote": None}
        if node is None:
            node = {"value": None, "page": None, "quote": None} if k in FIELD_PACK["cell_fields"] else None
        if isinstance(node, dict) and isinstance(node.get("value"), str) \
                and node["value"].strip().lower() in _NULL_STRINGS:
            node["value"] = None
        out[k] = node
    return out


def assemble_field_results(
    results: dict[str, UnitResult],
    spans: list[dict],
) -> tuple[dict[int, dict], list[tuple[int, str]]]:
    """→ ({index: fields}, failures[(index, error)]). 그룹 결과를 바우처 단위로 병합 —
    일부 그룹 실패는 해당 축 null(기권)로 진행, 전 그룹 실패만 바우처 실패."""
    extracted: dict[int, dict] = {}
    failures: list[tuple[int, str]] = []
    for i in range(len(spans)):
        merged: dict = {}
        ok_groups, err = 0, None
        for g in FIELD_GROUPS:
            r = results.get(f"{i}:{g}")
            data = parse_json_lenient(r.content)[0] if (r and r.ok and r.content) else None
            if isinstance(data, dict):
                merged.update({k: data.get(k) for k in FIELD_GROUPS[g]})
                ok_groups += 1
            else:
                err = err or ((r.error if r else None) or f"invalid json ({g})")
        fields = normalize_fields(merged) if ok_groups else None
        if fields is None:
            failures.append((i, err or "invalid json"))
            continue
        extracted[i] = fields
    return extracted, failures
