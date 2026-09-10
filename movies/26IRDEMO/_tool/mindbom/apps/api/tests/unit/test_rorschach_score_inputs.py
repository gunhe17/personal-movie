"""AI 채점 입력 검증 — 무엇이 없으면 채점을 걸지 않는가.

`missing_score_inputs`는 **화면과 서버가 공유하는 규칙**이다
(프론트는 `constants.canAiScore`). 서버만 열어두면 화면이 잠가도 API로
그대로 통과하고, 서버만 잠그면 눌리는 버튼이 실패한다.

셋 다 필요한 이유: 하나라도 비면 AI는 "모른다"가 아니라 **그럴듯한 값**을
내놓고, 그 값이 초안 칸에 앉아 임상가의 검토 대상이 된다. 근거 없는 제안을
검토하게 만드는 것이 검토를 안 받는 것보다 나쁘다.
"""
import pytest

from app.modules.examination.rorschach.services import missing_score_inputs


class _Response:
    """덕타이핑 더미 — 이 함수는 세 필드만 읽는다."""

    def __init__(
        self,
        free_association_text="박쥐 같아요",
        inquiry_text="날개가 펴져 있어서",
        area_code="W",
    ):
        self.free_association_text = free_association_text
        self.inquiry_text = inquiry_text
        self.area_code = area_code


class TestMissingScoreInputs:
    def test_all_present(self):
        assert missing_score_inputs(_Response()) == []

    @pytest.mark.parametrize(
        "field,label",
        [
            ("free_association_text", "반응 내용"),
            ("inquiry_text", "질문 답변"),
            ("area_code", "위치"),
        ],
    )
    def test_each_missing_is_named(self, field, label):
        """**이름을 대야** 임상가가 무엇을 채울지 안다(§14-12)."""
        r = _Response(**{field: None})
        assert missing_score_inputs(r) == [label]

    @pytest.mark.parametrize("blank", ["", "   ", "\n\t "])
    def test_whitespace_counts_as_missing(self, blank):
        """공백만 있는 칸은 빈 칸이다 — 있는 척하는 값이 제일 나쁘다."""
        assert missing_score_inputs(_Response(free_association_text=blank)) == [
            "반응 내용"
        ]

    def test_all_missing_lists_all(self):
        r = _Response(free_association_text=None, inquiry_text=None, area_code=None)
        assert missing_score_inputs(r) == ["반응 내용", "질문 답변", "위치"]

    def test_transcript_override_replaces_stored_text(self):
        """화면이 방금 받아쓴 텍스트를 보내면 그것으로 판정한다.

        `ScoreResponseService`는 저장된 텍스트가 비어 있어도 클라이언트가 보낸
        전사(또는 세션 전사에서 추출한 값)로 채점한다. 저장값만 보면 그 경로가
        **채점 직전에 거부**된다.
        """
        r = _Response(free_association_text=None)
        assert missing_score_inputs(r, "박쥐 같아요") == []

    def test_transcript_override_can_be_blank(self):
        """빈 override는 채우지 못한 것이다 — 저장값으로 되돌아가지 않는다.

        ⚠️ `transcript_override`가 `""`일 때 `or`로 저장값에 폴백하면,
        '전사 실패'가 '저장된 옛 텍스트로 채점'이 된다. 무엇을 근거로 채점했는지가
        어긋나는 자리라 명시적으로 고정한다.
        """
        assert missing_score_inputs(_Response(), "") == ["반응 내용"]
