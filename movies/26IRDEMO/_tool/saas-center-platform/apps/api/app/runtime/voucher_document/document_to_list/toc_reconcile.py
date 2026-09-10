"""목차 대사 + 분쟁 판정 + 공용 여집합 (lab E19·E20 verbatim).

결정론 우선: 목차(N-M 번호 체계)가 있으면 목차대로 과분리 병합·누락 복원 — 이 세트에서 정의상
정답. 보수 게이트(E20 사전 등록): 매칭률 <60% → 경고만·무교정 / 제거는 유사도 <0.45 일 때만 /
복원 삽입은 매칭된 사업 구간 내부로 한정. 목차가 없을 때만 K=2 분쟁 시작점을 판정자(sonnet-5,
E19 선발 9/10·안정성 1.0)에게 — 문서 분할 관점 프롬프트(E19 재프레임).
"""
from __future__ import annotations

import difflib
import re

import fitz

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.processing_spec import ARBITER_SYSTEM, MODEL_ARBITER

_TOC_NO = re.compile(r"^(\d+[-‐–]\d+)\.?\s+(\S.*)$")


def parse_toc(doc: fitz.Document) -> list[tuple[str, str, int]] | None:
    """앞쪽 15쪽에서 'N-M 제목 (± 인쇄쪽)' 목차 항목 → [(번호, 제목, 인쇄쪽)]. <3개면 None."""
    ent, seen = [], set()
    for i in range(min(15, doc.page_count)):
        lines = [l.strip() for l in doc[i].get_text().splitlines() if l.strip()]
        for j, l in enumerate(lines):
            m = _TOC_NO.match(l)
            if not m or m.group(1) in seen:
                continue
            title, pg = m.group(2), None
            m2 = re.search(r"[·.…‥\s](\d{1,3})$", title)
            if m2:
                title, pg = title[:m2.start()].strip(" .·…‥"), int(m2.group(1))
            else:
                for k in (j + 1, j + 2):
                    if k < len(lines) and re.fullmatch(r"\d{1,3}", lines[k]):
                        pg = int(lines[k])
                        break
            if pg and len(re.findall(r"[가-힣]", title)) >= 3:
                seen.add(m.group(1))
                ent.append((m.group(1), title, pg))
    return ent if len(ent) >= 3 else None


def _nm(s) -> str:
    return re.sub(r"[\s·･,()（）\[\]〈〉「」*]|사업|운영|실시", "", str(s))


def reconcile_with_toc(
    doc: fitz.Document,
    vouchers: list[dict],
    n_pages: int,
) -> tuple[list[dict], dict]:
    """→ (vouchers, report{mode, 교정[]}). 목차 없으면 mode="목차 없음", 무변경."""
    rep: dict = {"mode": "목차 없음", "교정": []}
    toc = parse_toc(doc)
    if not toc or not vouchers:
        return vouchers, rep

    def best(vname):
        e = max(toc, key=lambda e: difflib.SequenceMatcher(None, _nm(vname), _nm(e[1])).ratio())
        return e, difflib.SequenceMatcher(None, _nm(vname), _nm(e[1])).ratio()

    pairs = [(v, *best(v["name"])) for v in vouchers]
    rate = sum(1 for _, _, r in pairs if r >= 0.55) / len(vouchers)
    if rate < 0.6:
        rep["mode"] = f"목차 신뢰불가(매칭률 {rate:.0%}) — 경고만"
        return vouchers, rep
    rep["mode"] = f"목차 대사 (항목 {len(toc)}, 매칭률 {rate:.0%})"
    offs = sorted(v["start_page"] - e[2] for v, e, r in pairs if r >= 0.55)
    off = offs[len(offs) // 2]
    out, matched = [], set()
    for v, e, r in pairs:
        if r >= 0.55:
            matched.add(e[0])
            v.setdefault("no", e[0])                    # 목차 번호 방출 (소작업: no)
            out.append(v)
        elif r < 0.45:
            rep["교정"].append(f"병합: {v['name']} p{v['start_page']} (목차 무항목, 유사도 {r:.2f})")
        else:
            out.append(v)
            rep["교정"].append(f"유지(경고): {v['name']} p{v['start_page']} (유사도 {r:.2f})")
    starts = [v["start_page"] for v in out]
    for no, title, pg in toc:
        if no in matched:
            continue
        sp = pg + off
        if starts and min(starts) < sp <= max(starts):
            out.append({"name": title, "start_page": sp, "no": no, "toc_inserted": True})
            rep["교정"].append(f"복원: {no} {title} p{sp} (목차 {pg}+{off})")
    out.sort(key=lambda v: v["start_page"])
    last_end = max((v.get("end_page", 0) for v in vouchers), default=n_pages)
    for i, v in enumerate(out):
        v["end_page"] = out[i + 1]["start_page"] - 1 if i + 1 < len(out) else max(last_end, v["start_page"])
    return out, rep


def build_arbiter_units(
    doc: fitz.Document,
    vouchers: list[dict],
    diff_pages: list[int],
) -> list[BatchUnit]:
    """목차 부재 문서의 K=2 분쟁 시작점만 판정 유닛 (key = start_page)."""
    units = []
    for v in vouchers:
        p = v["start_page"]
        if p not in diff_pages:
            continue
        ctx = "\n".join(f"[p-{i:03d}]\n" + doc[i - 1].get_text()[:2500]
                        for i in (max(1, p - 1), p, min(doc.page_count, p + 1)))
        units.append(BatchUnit(
            key=str(p),
            model=MODEL_ARBITER,
            messages=[
                {"role": "system", "content": ARBITER_SYSTEM},
                {"role": "user", "content": f"제목: 「{v['name']}」\n\n<context>\n{ctx}\n</context>"},
            ],
            max_tokens=2000,
            response_format={"type": "json_object"},
            temperature=1.0,
            reasoning={"effort": "low"},
        ))
    return units


def apply_arbiter_results(
    vouchers: list[dict],
    results: dict[str, UnitResult],
) -> tuple[list[dict], list[str]]:
    """independent=false 인 분쟁 시작점 제거 → span 재계산. 응답 실패는 유지(안전 방향)."""
    logs, kept = [], []
    for v in vouchers:
        r = results.get(str(v["start_page"]))
        if r is not None:
            data = parse_json_lenient(r.content)[0] if (r.ok and r.content) else None
            ok = bool(data.get("independent", True)) if isinstance(data, dict) else True
            if not ok:
                logs.append(f"병합(판정): {v['name']} p{v['start_page']}")
                continue
            v["arbitrated"] = True
        kept.append(v)
    for i, v in enumerate(kept):
        if i + 1 < len(kept):
            v["end_page"] = kept[i + 1]["start_page"] - 1
    return kept, logs


def complement(n_pages: int, vouchers: list[dict]) -> list[dict]:
    """공용 = 여집합 (결정론, E-공용채점 정밀 100%) → [{"span": [a, b]}]."""
    cov = set()
    for v in vouchers:
        cov.update(range(v["start_page"], v["end_page"] + 1))
    out, s = [], None
    for p in range(1, n_pages + 2):
        if p <= n_pages and p not in cov:
            s = p if s is None else s
        elif s is not None:
            out.append({"span": [s, p - 1]})
            s = None
    return out


def scope_warning(n_pages: int, vouchers: list[dict]) -> str | None:
    """S0 스코프 게이트 v2: ≥120p ∧ 커버리지 <20% → 제도 매뉴얼·공통지침 의심 (경고만)."""
    cov = set()
    for v in vouchers:
        cov.update(range(v["start_page"], v["end_page"] + 1))
    coverage = len(cov) / max(n_pages, 1)
    if n_pages >= 120 and coverage < 0.20:
        return (f"스코프 밖 의심: {n_pages}p 중 바우처 구간이 {coverage:.0%}뿐 — "
                "제도 매뉴얼·공통 지침서일 가능성. 채택 전 문서 성격 확인 요망.")
    return None
