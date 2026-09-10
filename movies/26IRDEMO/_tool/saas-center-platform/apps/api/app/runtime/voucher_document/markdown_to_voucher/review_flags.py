"""검토 플래그 — "빈 축 유사물 채움"(lab E37 오류 유형학 ②)의 결정론 판정 (LLM 없음).

프롬프트 2연패·퓨샷 1패로 확정된 처방(E38~E39): 값은 보존하고 findings 경고만 남긴다(정직) —
확정 화면에서 사람 검토를 유도. 정밀 실측 8/8 · 오탐 0 (E39 신규 풀 포함).
capture(fields) 원문 표기 위에서 동작한다 — record 환산 전 단계.
"""
from __future__ import annotations

import json
import re

from app.runtime.voucher_document.common.region_master import resolve_unit

_CAPACITY = re.compile(r"\d\s*[:대]\s*\d|\d+\s*(명|인|가구)")
_QUALIFICATION = re.compile(
    r"자격|학위|학사|석사|경력|면허|수료|전공|이수|배치|상근|채용|인력|재활사|상담사|교사|요원"
    r"|심리사|치료사|졸업|과정|복지사|간호사|지도사|관리사|영양사|보육사|정신건강"
)
_SANCTION = re.compile(r"과태료|벌금|처벌")
_AGE_SIGNAL = re.compile(r"\d+\s*세|미만|이하|이상|영유아|성인|아동|청소년|노인|임산부|없음")


def flag_fields(fields: dict) -> list[dict]:
    """캡처 축 표면 검사 → [{유형:"검토플래그", 축, 요약(사유), 값}]. 값 변경 없음."""
    out: list[dict] = []

    def add(axis: str, why: str, val) -> None:
        out.append({"유형": "검토플래그", "축": axis, "요약": why, "값": str(val)[:80]})

    for r in fields.get("집단규모") or []:
        if not isinstance(r, dict):
            continue
        s = f"{r.get('조건', '')} {r.get('값', '')}"
        if not _CAPACITY.search(s):
            add("집단규모", "정원 신호 없음(한도·방식 의심)", r.get("값"))
    staff = fields.get("제공인력") or {}
    for r in (staff.get("자격") or []) if isinstance(staff, dict) else []:
        v = (r.get("value") or r.get("내용") or "") if isinstance(r, dict) else str(r)
        if v and not _QUALIFICATION.search(v):
            add("제공인력", "자격 요건 신호 없음(관계자 의심)", v)
    for g in fields.get("금액") or []:
        if isinstance(g, dict) and _SANCTION.search(json.dumps(g, ensure_ascii=False)):
            add("금액", "제재 어휘 포함(제재금 의심)", g.get("명칭"))
    age = fields.get("연령기준")
    v = age.get("value") if isinstance(age, dict) else age
    if v and not _AGE_SIGNAL.search(str(v)):
        add("연령기준", "연령 신호 없음", v)
    region = fields.get("지역") or {}
    names = [u.get("이름", "") for u in (region.get("지역들") or []) if isinstance(u, dict)] \
        if isinstance(region, dict) else []
    bad = [n for n in names if n and resolve_unit(n) is None]
    if names and len(bad) >= max(1, len(names) // 2):
        add("지역", "행정구역 미결속 이름 다수(격자 오인 의심)", ",".join(bad[:4]))
    return out
