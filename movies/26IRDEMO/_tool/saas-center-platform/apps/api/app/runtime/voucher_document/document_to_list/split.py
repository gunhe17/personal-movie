"""분리 — 후보 목록 → LLM 판정 K=2 합집합 → dedup → span 결정론 (lab E8a·E9·E11 verbatim).

K=2 의 실행 간 대칭차(diff_pages)는 목차 부재 문서에서 판정자 분쟁 집합이 된다.
span 은 결정론: 중간 바우처 끝 = 다음 시작 − 1 (LLM commons 불신 — 바우처 내부 절이 공용으로
오분류되면 span 이 붕괴하는 사고의 처방). 마지막만 서식·부록 어휘의 공용으로 닫는다.
"""
from __future__ import annotations

import re

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.processing_spec import (
    LIST_MAX_TOKENS,
    LIST_SPLIT_SYSTEM,
    MODEL_LIST,
)

CHUNK = 220
_TRAIL = re.compile(r"서식|부록|참고\s*자료|별지|찾아보기")
_CODE = re.compile(r"\b(\d{6})\b")


def build_split_units(
    cands: list[str],
    *,
    model: str = MODEL_LIST,
    k_runs: int = 2,
) -> list[BatchUnit]:
    """key = "k{run}:c{chunk}". 후보가 없으면 []."""
    units: list[BatchUnit] = []
    for kr in range(k_runs):
        for ci, i in enumerate(range(0, len(cands), CHUNK)):
            units.append(BatchUnit(
                key=f"k{kr}:c{ci}",
                model=model,
                messages=[
                    {"role": "system", "content": LIST_SPLIT_SYSTEM},
                    {"role": "user", "content": "<candidates>\n" + "\n".join(cands[i:i + CHUNK]) + "\n</candidates>"},
                ],
                max_tokens=LIST_MAX_TOKENS,
                response_format={"type": "json_object"},
                temperature=1.0,
                reasoning={"effort": "low"},
            ))
    return units


def _name_key(s: str) -> str:
    """동명 이코드 바우처 구분(6자리 코드) + 표기 잡음 제거 — dedup 키."""
    s = str(s)
    code = _CODE.search(s)
    base = re.sub(r"[\s\d부년()]|사업지침|지침|CDA", "", s)
    return base + (code.group(1) if code else "")


def assemble_split(
    results: dict[str, UnitResult],
    n_pages: int,
) -> tuple[list[dict], list[int]]:
    """→ (vouchers[{name, start_page, end_page, code?}], diff_pages). 결정론 후처리 v3."""
    per_run: dict[int, list[dict]] = {}
    commons: list[dict] = []
    for key, r in results.items():
        kr = int(key.split(":")[0][1:])
        data = parse_json_lenient(r.content)[0] if (r.ok and r.content) else None
        if not isinstance(data, dict):
            continue
        per_run.setdefault(kr, []).extend(v for v in data.get("vouchers") or []
                                          if isinstance(v, dict) and isinstance(v.get("start_page"), int) and v.get("name"))
        commons.extend(c for c in data.get("commons") or [] if isinstance(c, dict) and isinstance(c.get("start_page"), int))
    runs = [per_run[k] for k in sorted(per_run)]
    diff: list[int] = []
    if len(runs) >= 2:
        s0 = {v["start_page"] for v in runs[0]}
        s1 = {v["start_page"] for v in runs[-1]}
        diff = sorted(s0 ^ s1)
    picks = sorted((v for run in runs for v in run), key=lambda v: v["start_page"])
    seen, out = set(), []
    for v in picks:
        nm = _name_key(v["name"])
        near_dup = out and v["start_page"] - out[-1]["start_page"] <= 2 and _name_key(out[-1]["name"]) == nm
        if nm in seen or near_dup or (out and v["start_page"] == out[-1]["start_page"]):
            continue
        seen.add(nm)
        row = {"name": str(v["name"]).strip(), "start_page": v["start_page"]}
        code = _CODE.search(row["name"])
        if code:
            row["code"] = code.group(1)
        out.append(row)
    for i, v in enumerate(out):
        if i + 1 < len(out):
            v["end_page"] = out[i + 1]["start_page"] - 1
        else:
            close = min((c["start_page"] for c in commons
                         if c["start_page"] > v["start_page"] and _TRAIL.search(str(c.get("label", "")))),
                        default=n_pages + 1)
            v["end_page"] = close - 1
    return out, diff
