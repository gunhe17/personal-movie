"""normalize — S2b 캡처 → 정규화 레코드 (결정론 코드, LLM 아님).

E25 확장(2026-08-27): 프로덕션 verbatim + A형 갭 — 구간형 %·축약 나이범위·개월 단위·
화폐 단위(억/천만/백만원)·수급 어휘·절대액 소득. B형(서술형)은 None 유지가 계약 —
tests/unit/runtime/voucher_document/test_normalize_parsers.py 골든 배터리가 회귀·오파싱을 동결 감시.

2단 구조의 뒷단(정본: voucher-schema-validation.md Part 5·6, flat v2). 캡처가 원문 표기
그대로 담은 값("만 12세 미만"·"180천원"·"90%")을 코드가 표준형으로 환산한다 — 환산을 LLM 에
위임하면 모델별 3해석(capture/h04 E1 실측: 12/-1/11)이 나므로 여기가 유일한 환산 지점.

flat v2 = 중첩 폐기. 금액[](구 급여: 등급표·다중지원·단가 통합) + 집단규모/절차 조건부·flat +
운영규칙(open). 팩 v4.1(P10): 사업유형·항목 축 소멸, 신규 8축(목적·법적근거·신청·처리통지·
이의신청·신고의무·중지상실·환수)은 서술형 passthrough. 유지축: 지역·소득·연령·욕구·우선순위·
제외·중복금지·제공인력.

파싱 못 하는 값은 조용히 버리지 않고 record["항목"] 하강 + findings 소견으로 남긴다
("조용히 틀리는" → "시끄럽게 남는"). record 의 모든 축은 원문 앵커 ref={page, quote} 를
동반 — S2c 스내핑이 quote_pdf·match 를 주입한다.
"""
from __future__ import annotations

import re

from app.runtime.voucher_document.common.region_master import (
    expand_region_from_capture,
)

QUAL_WORDS = ("기초연금수급자", "기초생활수급자", "차상위계층", "차상위", "수급자", "수급권자", "수급가구", "한부모")

_AGE_RE = re.compile(
    r"만?\s?(\d+)\s?세\s?(이상|이하|미만|이내|까지)?\s?[~∼–-]?\s?(?:만?\s?(\d+)\s?세)?\s?(이상|이하|미만|이내|까지)?"
)
_WON_RE = re.compile(r"([\d,]+)\s*(억\s?원|천만\s?원|백만\s?원|만\s?원|천\s?원|원)")
_PCT_RE = re.compile(r"(\d+)\s?%")
_MONTHS_RE = re.compile(r"(\d+)\s?개월")


def _ref(cell) -> dict | None:
    if not isinstance(cell, dict):
        return None
    ref = {k: cell[k] for k in ("page", "quote", "quote_pdf") if cell.get(k)}
    return ref or None


def _val(cell) -> str | None:
    if isinstance(cell, dict):
        v = cell.get("value") or cell.get("내용")
        return v.strip() if isinstance(v, str) and v.strip() else None
    if isinstance(cell, str) and cell.strip():
        return cell.strip()
    return None


def parse_won(text: str) -> int | None:
    m = _WON_RE.search(text.replace(",", ""))
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2).replace(" ", "")
    mult = {"억원": 100_000_000, "천만원": 10_000_000, "백만원": 1_000_000,
            "만원": 10_000, "천원": 1_000}.get(unit, 1)
    return n * mult


def parse_pct(text: str) -> int | None:
    m = _PCT_RE.search(text)
    return int(m.group(1)) if m else None


def parse_age(text: str) -> dict | None:
    """연령 서술 → {없음|최소·최대·학적연장}. "N세 미만" → 최대 N-1 (환산은 여기서만)."""
    if re.search(r"연령.{0,6}(관계\s?없|무관|제한\s?없)|해당\s?없", text) \
            or text.strip() == "없음" or "전연령" in text.replace(" ", ""):
        return {"없음": True}
    m = _AGE_RE.search(text)
    if not m:
        return _age_ext(text)
    a, q1, b, q2 = m.group(1), m.group(2), m.group(3), m.group(4)
    r: dict = {}
    if b:
        r["최소"] = int(a)
        r["최대"] = int(b) - (1 if q2 == "미만" else 0)
    elif q1 in ("이하", "이내", "까지"):
        r["최대"] = int(a)
    elif q1 == "미만":
        r["최대"] = int(a) - 1
    elif q1 == "이상":
        r["최소"] = int(a)
    else:
        return _age_ext(text)
    if "재학" in text:
        r["학적연장"] = {"학교": "고등학교"}
    return r


def _age_ext(text: str) -> dict | None:
    """E25 확장 — 기존 _AGE_RE 실패분만: 축약 범위("6~12세")·개월 단위. 병기 범위는 None."""
    ranges = re.findall(r"(\d+)\s*[~∼–-]\s*(?:만\s?)?(\d+)\s?세", text)
    if len({tuple(x) for x in ranges}) > 1:
        return None                      # 상이 범위 병기(집단별 상이 기준) — 한 룰로 환원 금지
    if ranges:
        a, b = ranges[0]
        return {"최소": int(a), "최대": int(b) - (1 if re.search(r"세\s?미만", text) else 0)}
    ms = re.findall(r"(\d+)\s?개월", text)
    if ms:
        if len(ms) >= 2:
            return {"최소개월": int(ms[0]), "최대개월": int(ms[-1])}
        n = int(ms[0])
        return {"최소개월": n} if re.search(r"개월\s?(이상|부터)", text) else {"최대개월": n}
    return None


def parse_income(text: str) -> dict | None:
    """소득 서술 → {없음|최대(중위 %)·자격·판정·지역위임}. 복수 상이 % 는 실패(None)."""
    r: dict = {}
    if re.search(r"소득\s?기준\s?없|해당\s?없|없음|무관|관계\s?없", text):
        r["없음"] = True
    pcts = _PCT_RE.findall(text)
    upcts = sorted({int(x) for x in pcts})
    if len(upcts) == 1:
        r["최대"] = upcts[0]
        r.pop("없음", None)
    elif len(upcts) == 2 and re.search(r"초과|이상", text) and re.search(r"이하|미만", text):
        r["최소"], r["최대"] = upcts[0], upcts[1]   # 구간형 (E25) — derive는 최대만 써도 무해
        r.pop("없음", None)
    elif pcts:
        return None
    quals = [q for q in QUAL_WORDS if q in text]
    quals = [q for q in quals if not any(q != o and q in o for o in quals)]
    if quals:
        r["자격"] = quals
        r.pop("없음", None)
    if "건강보험료" in text:
        r["판정"] = "건강보험료"
    elif "소득인정액" in text:
        r["판정"] = "소득인정액"
    if "지역" in text and re.search(r"설정|변경|여건", text):
        r["지역위임"] = True
    if not pcts and re.search(r"이하|미만", text):   # 절대액 소득 상한 (E25) — "360만원 이하"
        won = parse_won(text)
        if won is not None:
            r["최대액"] = won
            r.pop("없음", None)
    return r or None


def parse_amount_cell(text: str) -> dict | None:
    """금액 셀 — "180,000원(90%)"→{금액,비율}, "90%"→{비율}, "면제|무료"→{금액:0}."""
    r: dict = {}
    if re.search(r"면제|무료", text):
        return {"금액": 0}
    won = parse_won(text)
    pct = parse_pct(text)
    if won is not None:
        r["금액"] = won
    if pct is not None:
        r["비율"] = pct
    return r or None


class _Ctx:
    """축 매핑 중 소견·항목 하강 수집."""

    def __init__(self):
        self.findings: list[dict] = []
        self.items: list[dict] = []

    def drop(
        self,
        axis: str,
        label: str,
        value,
        ref: dict | None,
        why: str = "파싱실패",
    ) -> None:
        self.items.append({"라벨": label, "값": str(value), "ref": ref})
        self.findings.append({"유형": why, "축": axis, "요약": str(value)[:80]})


def _cells(nodes) -> list[dict]:
    """캡처 배열([{내용|value, page, quote}]) → [{내용, ref}] 항목 기본형."""
    out = []
    for n in nodes or []:
        v = _val(n)
        if v:
            out.append({"내용": v, "ref": _ref(n)})
    return out


def _cond(node) -> dict | None:
    """조건 dict 정리 — 값 있는 차원만 문자열로. 전부 비면 None(=무조건)."""
    cond = node.get("조건") if isinstance(node, dict) else None
    if isinstance(cond, str) and cond.strip():
        return {"구분": cond.strip()}          # 모델이 명세(dict) 대신 문자열로 낸 경우 — 라벨 보존
    if not isinstance(cond, dict):
        return None
    r = {str(k): str(v).strip() for k, v in cond.items() if v not in (None, "")}
    return r or None


# ── 검증된 9축 (§1~§10 그대로, 무변경) ──


def _map_region(
    c: _Ctx,
    node,
) -> dict | None:
    """레거시 record 매핑 — 전 지역 목록은 expand_region_from_capture 파생 사용."""
    if not isinstance(node, dict):
        return None
    pairs = expand_region_from_capture(node)
    if node.get("전국") is True:
        return {"추진지역": pairs, "전국": True, "ref": _ref(node)}
    # 미결속 이름 소견 (파생에서 건너뛴 것)
    for u in node.get("지역들") or []:
        if not isinstance(u, dict) or u.get("mark") == "X":
            continue
        name = (u.get("이름") or "").strip()
        if not name:
            continue
        from app.runtime.voucher_document.common.region_master import resolve_unit
        if resolve_unit(name) is None:
            c.drop("지역", "지역(미결속)", name, _ref(node), "지역결속실패")
    if not pairs:
        return None
    return {"추진지역": pairs, "ref": _ref(node)}


def _map_income(
    c: _Ctx,
    cell,
) -> dict | None:
    v = _val(cell)
    if not v:
        return None
    r = parse_income(v)
    if r is None:
        c.drop("소득기준", "소득기준(비정형)", v, _ref(cell))
        return None
    r["ref"] = _ref(cell)
    return r


def _map_age(
    c: _Ctx,
    cell,
) -> dict | None:
    v = _val(cell)
    if not v:
        return None
    r = parse_age(v)
    if r is None:
        c.drop("연령기준", "연령기준(비정형)", v, _ref(cell))
        return None
    r["ref"] = _ref(cell)
    return r


def _map_need(node) -> dict | None:
    if not isinstance(node, dict):
        return None
    indicators = []
    for i in node.get("지표") or []:
        if not isinstance(i, dict):
            continue
        v = _val(i)
        if not v:
            continue
        row = {"내용": v, "ref": _ref(i)}
        evidence = i.get("증빙")
        if isinstance(evidence, list) and evidence:
            row["증빙"] = [str(e) for e in evidence]
        indicators.append(row)
    if not indicators:
        return None
    r = {"지표": indicators}
    discretion = _val(node.get("재량"))
    if discretion:
        r["재량판단"] = {"내용": discretion, "ref": _ref(node.get("재량"))}
    return r


def _map_dup(node) -> dict | None:
    if not isinstance(node, dict):
        return None
    r: dict = {}
    for key in ("불가", "허용"):
        vals = [str(x).strip() for x in (node.get(key) or []) if str(x).strip()]
        if vals:
            r[key] = vals
    if not r:
        return None
    r["ref"] = _ref(node)
    return r


def _map_staff(node) -> dict | None:
    if not isinstance(node, dict):
        return None
    r: dict = {}
    quals = _cells(node.get("자격"))
    bans = _cells(node.get("결격"))
    if quals:
        r["자격경로"] = quals
    if bans:
        r["결격"] = bans
    return r or None


# ── flat v2 신규 매퍼 ──


def _map_services(node) -> list[dict]:
    """서비스 [{유형명?, 내용:[{설명, page, quote}]}] → [{유형명?, 내용:[{설명, ref}]}]."""
    out = []
    for s in node or []:
        if not isinstance(s, dict):
            continue
        contents = []
        for con in s.get("내용") or []:
            if not isinstance(con, dict):
                continue
            desc = con.get("설명")
            desc = desc.strip() if isinstance(desc, str) and desc.strip() else None
            if desc:
                contents.append({"설명": desc, "ref": _ref(con)})
        name = s.get("유형명")
        name = name.strip() if isinstance(name, str) and name.strip() else None
        if not contents and not name:
            continue
        row: dict = {"내용": contents}
        if name:
            row["유형명"] = name
        out.append(row)
    return out


def _map_group_size(nodes) -> list[dict]:
    """집단규모 조건부 passthrough — 값은 원문 비율/정원(파싱 안 함). 값 없는 빈 항목은 버림."""
    out = []
    for n in nodes or []:
        if not isinstance(n, dict):
            continue
        v = n.get("값")
        v = v.strip() if isinstance(v, str) and v.strip() else None
        if not v:
            continue
        row: dict = {"값": v, "ref": _ref(n)}
        cond = _cond(n)
        if cond:
            row["조건"] = cond
        out.append(row)
    return out


def _map_stages(nodes) -> list[dict]:
    """절차 flat — [{내용, ref}]."""
    return _cells(nodes)


def _map_benefit_amounts(
    c: _Ctx,
    entries,
    benefit_name: str,
    fallback_ref: dict | None = None,
) -> list[dict]:
    """금액 묶음의 금액 조건부 — 정부지원/본인부담(등급표) 분리 + 단일액. 원문→표준형 환산."""
    out = []
    for e in entries or []:
        if not isinstance(e, dict):
            continue
        row: dict = {}
        cond = _cond(e)
        if cond:
            row["조건"] = cond
        for src, money_key, ratio_key in (
            ("정부지원", "정부지원금", "정부지원비율"),
            ("본인부담", "본인부담금", "본인부담비율"),
        ):
            raw = e.get(src)
            if raw in (None, ""):
                continue
            parsed = parse_amount_cell(str(raw))
            if parsed is None:
                c.drop("금액", f"{benefit_name} {src}(비정형)", raw, _ref(e))
                continue
            if "금액" in parsed:
                row[money_key] = parsed["금액"]
            if "비율" in parsed:
                row[ratio_key] = parsed["비율"]
        single = e.get("값")
        if single not in (None, ""):
            won = parse_won(str(single))
            if won is not None:
                row["금액"] = won
            else:
                c.drop("금액", f"{benefit_name} 금액(비정형)", single, _ref(e))
        if len(row) - ("조건" in row) == 0:  # 조건 외 값 하나도 못 담음
            continue
        row["ref"] = _ref(e) or fallback_ref      # 행에 page 없으면 묶음 출처 상속
        out.append(row)
    return out


def _map_benefits(
    c: _Ctx,
    nodes,
) -> list[dict]:
    """금액[] (구 급여) — 지원금·가격 목록. 각 항목의 금액은 조건부(등급표 흡수)."""
    out = []
    for b in nodes or []:
        if not isinstance(b, dict):
            continue
        name = b.get("명칭")
        name = name.strip() if isinstance(name, str) and name.strip() else "?"
        row: dict = {"명칭": name}
        amounts = _map_benefit_amounts(c, b.get("금액"), name, _ref(b))
        if amounts:
            row["금액"] = amounts
        for key in ("주기", "적용대상", "수급자"):
            v = b.get(key)
            if isinstance(v, str) and v.strip():
                row[key] = v.strip()
        row["ref"] = _ref(b)
        out.append(row)
    return out


def _map_op_rules(nodes) -> list[dict]:
    """운영규칙[] — open 종류. 지원기간은 개월 환산."""
    out = []
    for n in nodes or []:
        if not isinstance(n, dict):
            continue
        content = _val(n)
        if not content:
            continue
        kind = n.get("종류")
        kind = kind.strip() if isinstance(kind, str) and kind.strip() else "?"
        row: dict = {"종류": kind, "내용": content, "ref": _ref(n)}
        if "기간" in kind:
            m = _MONTHS_RE.search(content)
            if m:
                row["개월"] = int(m.group(1))
        out.append(row)
    return out


def _map_cell(cell) -> dict | None:
    """단일 셀 축(목적·처리통지·이의신청·환수) — {내용, ref}."""
    v = _val(cell)
    if not v:
        return None
    return {"내용": v, "ref": _ref(cell)}


def _map_legal(nodes) -> list[dict]:
    """법적근거 [{조문, 내용}] — 조문은 있을 때만."""
    out = []
    for n in nodes or []:
        if not isinstance(n, dict):
            continue
        content = _val(n) or (str(n.get("내용")).strip() if n.get("내용") else None)
        clause = str(n.get("조문")).strip() if n.get("조문") else None
        if not (content or clause):
            continue
        row: dict = {"내용": content or clause, "ref": _ref(n)}
        if clause and content:
            row["조문"] = clause
        out.append(row)
    return out


def _map_apply(node) -> dict | None:
    """신청 {신청권자[], 경로[], 서류[{이름, 서식번호?, 조건?}]}."""
    if not isinstance(node, dict):
        return None
    r: dict = {}
    for key in ("신청권자", "경로"):
        vals = [str(x).strip() for x in (node.get(key) or []) if str(x).strip()]
        if vals:
            r[key] = vals
    docs = []
    for d in node.get("서류") or []:
        if not isinstance(d, dict):
            continue
        name = str(d.get("이름")).strip() if d.get("이름") else _val(d)
        if not name:
            continue
        row: dict = {"이름": name, "ref": _ref(d)}
        for k in ("서식번호", "조건"):
            v = d.get(k)
            if isinstance(v, (str, int)) and str(v).strip():
                row[k] = str(v).strip()
        docs.append(row)
    if docs:
        r["서류"] = docs
    if not r:
        return None
    r["ref"] = _ref(node)
    return r


def _map_stop(nodes) -> list[dict]:
    """중지상실 [{사유, 시점?, 조치?}]."""
    out = []
    for n in nodes or []:
        if not isinstance(n, dict):
            continue
        reason = str(n.get("사유")).strip() if n.get("사유") else _val(n)
        if not reason:
            continue
        row: dict = {"사유": reason, "ref": _ref(n)}
        for k in ("시점", "조치"):
            v = n.get(k)
            if isinstance(v, str) and v.strip():
                row[k] = v.strip()
        out.append(row)
    return out


def map_capture(capture: dict) -> tuple[dict, list[dict]]:
    """캡처(원문 표기) → (정규화 record, findings). 파싱 실패 값은 record["항목"] 하강.

    팩 v4.1: 사업유형·항목 캡처 축 소멸 — record["항목"]은 하강 채널로만 유지."""
    c = _Ctx()
    # D18: 축 키 금액. 구 캡처(급여) 키는 읽기 호환만.
    money_nodes = capture.get("금액")
    if money_nodes is None:
        money_nodes = capture.get("급여")
    record = {
        "목적": _map_cell(capture.get("목적")),
        "법적근거": _map_legal(capture.get("법적근거")),
        "지역": _map_region(c, capture.get("지역")),
        "소득기준": _map_income(c, capture.get("소득기준")),
        "연령기준": _map_age(c, capture.get("연령기준")),
        "욕구기준": _map_need(capture.get("욕구기준")),
        "우선순위": _cells(capture.get("우선순위")),
        "제외": _cells(capture.get("제외")),
        "중복금지": _map_dup(capture.get("중복금지")),
        "서비스": _map_services(capture.get("서비스")),
        "집단규모": _map_group_size(capture.get("집단규모")),
        "절차": _map_stages(capture.get("절차")),
        "신청": _map_apply(capture.get("신청")),
        "처리통지": _map_cell(capture.get("처리통지")),
        "이의신청": _map_cell(capture.get("이의신청")),
        "신고의무": _cells(capture.get("신고의무")),
        "중지상실": _map_stop(capture.get("중지상실")),
        "환수": _map_cell(capture.get("환수")),
        "금액": _map_benefits(c, money_nodes),
        "제공인력": _map_staff(capture.get("제공인력")),
        "운영규칙": _map_op_rules(capture.get("운영규칙")),
    }
    record["항목"] = c.items
    return record, c.findings
