"""통합 해석 룰베이스 요약 self-check — AI 미연동 폴백이 결정론적으로 동작하는지."""
from app.infrastructure.ai.remote import _rule_summarize_report
from app.modules.comprehensive_report.services import _calc_age


def test_rule_summarize_produces_per_exam_and_comprehensive():
    exams = [
        {"exam_id": "e1", "exam_type": "htp",
         "findings": ["지붕이 크다", "문이 없다"], "summary": ""},
        {"exam_id": "e2", "exam_type": "sct",
         "findings": ["가족 영역 갈등 시사 (점수 12/18)"], "summary": ""},
        {"exam_id": "e3", "exam_type": "rorschach", "findings": [], "summary": ""},
    ]
    client = {"name": "홍길동", "gender": "male", "birth_date": "2000-01-01", "age": 26}

    r1 = _rule_summarize_report(client, exams)
    r2 = _rule_summarize_report(client, exams)

    # 결정론성 — LLM 아님, 같은 입력 → 같은 출력
    assert r1.model_dump() == r2.model_dump()
    # 검사별 해석 3건, 순서 보존
    assert [p.exam_id for p in r1.per_exam] == ["e1", "e2", "e3"]
    # 각 검사 = 임상 한 줄(clinical) + 쉬운 번역 한 줄(plain), 검사당 한 줄씩
    htp = r1.per_exam[0]
    assert "지붕이 크다" in htp.clinical              # 임상 = 소견 반영
    assert "지붕이 크다" in htp.plain                 # 번역에도 반영
    assert "선생님" in htp.plain
    # findings 없는 검사도 clinical/plain 채워짐
    assert r1.per_exam[2].clinical
    assert r1.per_exam[2].plain
    # 종합: 임상 한 줄(comprehensive) + 쉬운 번역 한 줄(plain_summary)
    assert "홍길동" in r1.comprehensive
    assert "임상가" in r1.comprehensive
    assert "홍길동님" in r1.plain_summary
    assert "선생님" in r1.plain_summary
    assert r1.key_findings  # 소견이 있으면 핵심소견 채워짐


def test_rule_summarize_no_findings():
    r = _rule_summarize_report({"name": None}, [
        {"exam_id": "e1", "exam_type": "htp", "findings": [], "summary": ""},
    ])
    assert "내담자" in r.comprehensive          # 이름 없으면 기본값
    assert r.key_findings == []


def test_age_helper():
    """나이 계산 — 종합보고서 헤더에 찍히는 값.

    구 examination/report 모듈 폐기(2026-08-19)로 대상이 _calc_age로 바뀌었다.
    같은 계산이 두 군데 있었고, 살아남은 쪽이 이것이다.
    """
    from datetime import date
    assert _calc_age(None) == "-"
    # 생일 이전/이후 경계
    born = date(2000, 12, 31)
    assert _calc_age(born).startswith("만 ")


if __name__ == "__main__":
    test_rule_summarize_produces_per_exam_and_comprehensive()
    test_rule_summarize_no_findings()
    test_age_helper()
    print("OK")
