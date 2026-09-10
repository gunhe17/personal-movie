"""parse_analysis 회귀 테스트 — title 키 추가에 따른 폴백 동작 보존.

핵심 불변식:
- 유효한 구조화 JSON → (summary, analysis_json) 반환, title 포함.
- 평문(비JSON) 응답 → 평문 폴백 (analysis_json=None).
- title 만 있고 다른 의미 필드가 전혀 없으면 평문 폴백 (title 은 폴백 판정에 미포함).
- title 과도 길이는 30자로 절단, 빈 문자열은 None.
"""
import json

from app.runtime.field_note.summary.parsing import parse_analysis

parse = parse_analysis


def test_structured_json_includes_title():
    content = json.dumps({
        "title": "등교 거부와 모자 갈등",
        "summary": "등교 거부 문제에 대해 이야기함",
        "keywords": ["등교 거부"],
        "issues": [],
        "mood": None,
        "highlights": [{"t": 30, "text": "갈등 언급"}],
    }, ensure_ascii=False)

    summary, analysis_json = parse(content)

    assert summary == "등교 거부 문제에 대해 이야기함"
    analysis = json.loads(analysis_json)
    assert analysis["title"] == "등교 거부와 모자 갈등"
    assert analysis["keywords"] == ["등교 거부"]


def test_plain_text_falls_back():
    summary, analysis_json = parse("그냥 평문 요약입니다.")
    assert summary == "그냥 평문 요약입니다."
    assert analysis_json is None


def test_title_only_falls_back_to_plain():
    """title 만 있고 의미 필드가 없으면 평문 폴백 — title 은 폴백 판정 제외."""
    content = json.dumps({"title": "제목만 있음"}, ensure_ascii=False)
    summary, analysis_json = parse(content)
    assert summary == content.strip()
    assert analysis_json is None


def test_missing_title_is_none():
    content = json.dumps({"summary": "요약만 있는 구버전 응답"}, ensure_ascii=False)
    _, analysis_json = parse(content)
    assert json.loads(analysis_json)["title"] is None


def test_long_title_truncated_and_blank_title_none():
    long_title = "가" * 50
    content = json.dumps({"title": long_title, "summary": "요약"}, ensure_ascii=False)
    _, analysis_json = parse(content)
    assert json.loads(analysis_json)["title"] == "가" * 30

    content2 = json.dumps({"title": "   ", "summary": "요약"}, ensure_ascii=False)
    _, analysis_json2 = parse(content2)
    assert json.loads(analysis_json2)["title"] is None
