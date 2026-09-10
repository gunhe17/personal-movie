"""normalize 파서 골든 — lab E25 배터리(코퍼스 실값 340개) 동결. 회귀·오파싱 감시 (LLM 없음)."""
from __future__ import annotations

import json
from pathlib import Path

from app.runtime.voucher_document.markdown_to_voucher.normalize import (
    parse_age,
    parse_amount_cell,
    parse_income,
    parse_won,
)

BAT = json.loads((Path(__file__).parent / "fixtures" / "parser_battery.json").read_text(encoding="utf-8"))
FNS = {"연령": parse_age, "소득": parse_income, "금액": parse_amount_cell}


def _income_superset_ok(old, new) -> bool:
    """E25 어휘 추가로 자격 리스트만 초집합 허용 — 그 외 키·값은 동일해야 한다."""
    if not isinstance(old, dict) or not isinstance(new, dict):
        return old == new
    for k, v in old.items():
        if k == "자격":
            if not set(v) <= set(new.get("자격", [])):
                return False
        elif new.get(k) != v:
            return False
    return all(k in old or k == "자격" for k in new)


def test_no_regression_on_previously_parsed_values():
    for cat, entries in BAT.items():
        fn = FNS[cat]
        for e in entries:
            if e["구판"] is None:
                continue
            new = fn(e["입력"])
            ok = _income_superset_ok(e["구판"], new) if cat == "소득" else new == e["구판"]
            assert ok, (cat, e["입력"], e["구판"], new)


def test_pass_rates_hold_e25_floor():
    rate = {cat: sum(1 for e in es if FNS[cat](e["입력"]) is not None) / len(es) for cat, es in BAT.items()}
    assert rate["연령"] >= 0.78      # B형(서술형) 천장 실측 78.7%
    assert rate["소득"] >= 0.87
    assert sum(1 for e in BAT["금액"] if parse_amount_cell(e["입력"]) is not None) \
        >= sum(1 for e in BAT["금액"] if e["구판"] is not None)


def test_type_a_extensions_parse_exactly():
    assert parse_won("서울 80백만원") == 80_000_000
    assert parse_won("8천만원") == 80_000_000
    assert parse_age("6~12세 아동 혹은 초등학생") == {"최소": 6, "최대": 12}
    assert parse_age("생후 14일부터 71개월까지") == {"최대개월": 71}
    assert parse_age("만 18세까지 지원하며, 학교에 재학 중인 경우에는 졸업시까지 지원") \
        == {"최대": 18, "학적연장": {"학교": "고등학교"}}
    assert parse_age("전 연령 (아동 및 노인 포함)") == {"없음": True}
    assert parse_income("소득인정액 기준 중위소득 50% 초과 100% 이하") == {"최소": 50, "최대": 100, "판정": "소득인정액"}
    assert parse_income("소득금액이 360만원 이하이고, 동시에 과표재산이 13,500만원 이하") == {"최대액": 3_600_000}
    assert parse_income("생계·의료·주거·교육 급여 수급가구") == {"자격": ["수급가구"]}


def test_type_b_narratives_stay_none():
    assert parse_age("돌봄 필요 청·중장년(19~64세), 가족돌봄청년(9~39세, 청소년 포함)") is None   # 병기 가드
    assert parse_age("노인") is None and parse_age("고령의 독거 여성장애인") is None
    assert parse_income("위탁아동을 양육하기에 적합한 수준의 소득이 있을 것") is None
    assert parse_amount_cell("월 66시간") is None
    assert parse_amount_cell("거주지 해당지역 사업시행기관에 문의") is None


def test_boundary_arithmetic_is_code_owned():
    assert parse_age("18세 미만")["최대"] == 17          # capture/h04: LLM 3해석(12/-1/11) → 코드 유일 환산
    assert parse_age("만 7세 ~ 15세 이하") == {"최소": 7, "최대": 15}


def test_ref_keeps_quote_pdf_and_cond_accepts_string():
    from app.runtime.voucher_document.markdown_to_voucher.normalize import _cond, _ref
    assert _ref({"page": "p-006", "quote": "q", "quote_pdf": "qp", "match": "exact"}) == \
        {"page": "p-006", "quote": "q", "quote_pdf": "qp"}
    assert _cond({"조건": "1등급(기초생활수급자)"}) == {"구분": "1등급(기초생활수급자)"}
    assert _cond({"조건": {"등급": "2등급", "연령": None}}) == {"등급": "2등급"}
    assert _cond({"조건": ""}) is None


def test_amount_rows_inherit_group_ref():
    from app.runtime.voucher_document.markdown_to_voucher.normalize import map_capture
    rec, _ = map_capture({"금액": [{"명칭": "가격", "page": "p-007", "quote": "월 20만원",
                                    "금액": [{"조건": "1등급", "정부지원": "180,000원(90%)", "본인부담": "20,000원(10%)"}]}]})
    row = rec["금액"][0]["금액"][0]
    assert row["ref"] == {"page": "p-007", "quote": "월 20만원"} and row["조건"] == {"구분": "1등급"}
