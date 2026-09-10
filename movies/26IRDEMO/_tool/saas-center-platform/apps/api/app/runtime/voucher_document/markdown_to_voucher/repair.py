"""repair — 분쟁 셀 한정 재추출 (lab E21 실증 구조). 실행은 runner `run_stage_realtime`가 소유.

verify 등급이 REPAIR_GRADES(미확인·출처불량·형식불량)인 셀만 상급 모델(ARBITER)로 그 필드 하나를
재추출하고, **같은 verify 재채점을 통과(확인 계열·기권)할 때만** 교체한다 — 침묵 승격 금지.
재추출도 null 이면 "원문에 없음"이 확증된 정직한 기권(E21 실측 2/2).

프로덕션 MD 는 표가 HTML 텍스트로 전사돼 있어 텍스트 슬라이스만으로 충분(lab 은 표 이미지 동반).
"""
from __future__ import annotations

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.page_markdown import page_num, pages_markdown
from app.runtime.voucher_document.processing_spec import (
    MODEL_ARBITER,
    REPAIR_MAX_PER_VOUCHER,
    REPAIR_MAX_TOKENS,
    REPAIR_SYSTEM,
)

from .verification import REPAIR_GRADES, verify_cells

_NULL_STRINGS = ("null", "none")


def _fields_of(v: dict) -> dict | None:
    f = v.get("fields")
    return f if isinstance(f, dict) else (v.get("capture") if isinstance(v.get("capture"), dict) else None)


def build_repair_units(
    *,
    pages: dict[int, str],
    vouchers: list[dict],
    field_defs: dict[str, str],
) -> list[BatchUnit]:
    """분쟁 셀 → 유닛 (key = "{voucher_idx}:{field}"). 바우처당 REPAIR_MAX_PER_VOUCHER 건 상한."""
    units: list[BatchUnit] = []
    for i, v in enumerate(vouchers):
        ver = v.get("verify") or {}
        span = v.get("span") or [0, 0]
        lo = span[0] if isinstance(span[0], int) else (page_num(span[0]) or 0)
        hi = span[1] if isinstance(span[1], int) else (page_num(span[1]) or 0)
        slice_text = pages_markdown(pages, lo, hi)
        n = 0
        for field, grade in ver.items():
            if grade not in REPAIR_GRADES or n >= REPAIR_MAX_PER_VOUCHER:
                continue
            n += 1
            system = REPAIR_SYSTEM.format(field=field, fdef=field_defs.get(field, ""))
            units.append(BatchUnit(
                key=f"{i}:{field}",
                model=MODEL_ARBITER,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"<voucher_text>\n{slice_text}\n</voucher_text>"},
                ],
                max_tokens=REPAIR_MAX_TOKENS,
                response_format={"type": "json_object"},
                temperature=1.0,
                reasoning={"effort": "low"},
            ))
    return units


def apply_repair_results(
    vouchers: list[dict],
    results: dict[str, UnitResult],
    texts: dict[int, str],
) -> list[str]:
    """재추출 결과 → 재채점 통과분만 교체(repaired=True, verify 갱신). → 교정 로그."""
    logs: list[str] = []
    for key, r in results.items():
        i_str, field = key.split(":", 1)
        i = int(i_str)
        if i >= len(vouchers):
            continue
        v = vouchers[i]
        fields = _fields_of(v)
        if fields is None:
            continue
        old = v["verify"].get(field, "?")
        data = parse_json_lenient(r.content)[0] if (r.ok and r.content) else None
        node = data.get(field) if isinstance(data, dict) else None
        if not isinstance(node, dict):
            logs.append(f"{v.get('name', '?')[:16]}·{field}: {old} 유지(재추출 실패)")
            continue
        if isinstance(node.get("value"), str) and node["value"].strip().lower() in _NULL_STRINGS:
            node["value"] = None
        span = v.get("span") or [0, 0]
        g2 = verify_cells({field: node}, texts, span[0], span[1]).get(field)
        if g2 and (g2.startswith("확인") or g2 == "기권"):
            node["repaired"] = True
            fields[field] = node
            v["verify"][field] = g2
            logs.append(f"{v.get('name', '?')[:16]}·{field}: {old}→{g2}")
        else:
            logs.append(f"{v.get('name', '?')[:16]}·{field}: {old} 유지(재추출도 {g2})")
    return logs
