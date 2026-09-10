"""공유문 변환 산출물의 경계 — LLM이 뭘 뱉든 앱에 나가는 키는 다섯 개뿐이다.

모델이 진단 소견 같은 키를 덧붙여도 화이트리스트가 잘라낸다(임상 원문 비노출 G1의 마지막 방벽).
"""

import pytest

from app.application.handlers.counseling.generate_guardian_share import (
    _resolve_audience,
)
from app.modules.counseling.counseling_note_share.models import NoteShareAudience
from app.runtime.guardian_share.service import CONTENT_KEYS, _parse_content


def test_extra_keys_are_dropped():
    content = _parse_content(
        '{"text": "오늘은 편안했어요", "diagnosis": "ADHD 의심", "raw_notes": "원문"}'
    )
    assert set(content) == set(CONTENT_KEYS)
    assert content["text"] == "오늘은 편안했어요"


def test_code_fence_is_stripped():
    content = _parse_content('```json\n{"text": "오늘은 편안했어요"}\n```')
    assert content["text"] == "오늘은 편안했어요"


def test_list_value_is_joined():
    content = _parse_content('{"text": ["감정 표현", "역할극"]}')
    assert content["text"] == "감정 표현 역할극"


def test_blank_string_becomes_none():
    with pytest.raises(ValueError):
        _parse_content('{"text": "   "}')


def test_all_empty_is_rejected():
    with pytest.raises(ValueError):
        _parse_content('{"text": null}')


def test_unparseable_is_rejected():
    with pytest.raises(ValueError):
        _parse_content("죄송하지만 도와드릴 수 없습니다")


@pytest.mark.parametrize(
    "requested,age,expected",
    [
        (None, 8, NoteShareAudience.GUARDIAN),
        (None, 19, NoteShareAudience.SELF),
        (None, 34, NoteShareAudience.SELF),
        (None, None, NoteShareAudience.GUARDIAN),
        ("self", 8, NoteShareAudience.SELF),
        ("guardian", 40, NoteShareAudience.GUARDIAN),
        ("nonsense", 40, NoteShareAudience.SELF),
    ],
)
def test_audience_resolution(requested, age, expected):
    assert _resolve_audience(requested, age) == expected


# ── 민감 표현 고지 — 차단이 아니라 발행 직전 알림 ──


def test_sensitive_detection_on_share_text():
    from app.modules.counseling.counseling_note_share.sensitivity import (
        detect_sensitive_categories,
    )

    flagged = detect_sensitive_categories(
        {"text": "시험 성적 발표 후 자해를 한 번 했다고 이야기했어요."}
    )
    assert flagged == ["자해·자살 관련"]


def test_ordinary_share_is_not_flagged():
    from app.modules.counseling.counseling_note_share.sensitivity import (
        detect_sensitive_categories,
    )

    assert detect_sensitive_categories(
        {"text": "보드게임을 하면서 규칙을 두 번 어겼지만 다시 참여했어요."}
    ) == []


def test_multiple_categories_are_all_reported():
    from app.modules.counseling.counseling_note_share.sensitivity import (
        detect_sensitive_categories,
    )

    flagged = detect_sensitive_categories(
        {"text": "자해 이야기를 했고, 엄마 알면 힘들어진다고 했어요."}
    )
    assert set(flagged) == {"자해·자살 관련", "본인이 알리지 않기를 원한 내용"}


def test_response_exposes_categories():
    from app.modules.counseling.counseling_note_share.schemas import (
        CounselingNoteShareResponse,
    )

    resp = CounselingNoteShareResponse(
        id="s1", center_id="c1", counseling_session_id="cs1", client_id="cl1",
        counseling_note_id=None, author_id="m1", llm_call_id=None,
        audience="guardian", status="draft",
        content={"text": "자해 관련 이야기를 나눴어요."},
        is_edited=False, published_at=None,
        created_at="2026-08-28T00:00:00", updated_at="2026-08-28T00:00:00",
    )
    assert resp.sensitive_categories == ["자해·자살 관련"]
