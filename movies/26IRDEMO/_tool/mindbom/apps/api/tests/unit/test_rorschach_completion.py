"""완료 판정 규칙 (§14-4, §14-11, §14-12).

여기서 고정하는 것은 **두 축이 어긋나지 않는다**는 사실이다:
- 실시 완료는 카드가 아니라 반응까지 본다 (영역 0개인 반응이 조용히 빠지지 않는다)
- 채점 완료는 `final_coding_json`을 본다 (AI 초안은 확정이 아니다)

두 규칙 다 실제로 깨져 있던 것이다. 확정 검사 17건 중 `inquiry_text`가
채워진 반응이 0건이었고, AI 초안만 있는 반응 4건이 확정을 통과할 수 있었다.
"""

from datetime import datetime

import pytest

from app.modules.examination.rorschach.completion import (
    CARD_NUMBERS,
    administration_done,
    card_recorded,
    describe_response,
    response_coded,
    response_recorded,
    display_numbers,
    uncoded_responses,
    unfinished_cards,
)


class _Response:
    def __init__(
        self,
        card_no=1,
        response_no=1,
        is_formal=True,
        id=None,
        created_at=0,
        regions=1,
        free_association_text="박쥐 같아요",
        inquiry_text="날개가 펴져서",
        final_coding_json=None,
        ai_coding_json=None,
        coding_stale_at=None,
    ):
        self.card_no = card_no
        # sort_seq는 정렬 서열이다 — 화면 번호는 display_numbers()가 파생시킨다.
        self.sort_seq = response_no
        self.id = id if id is not None else f"r{card_no}-{response_no}"
        self.created_at = created_at
        self.is_formal = is_formal
        self.region_ids = ["g"] * regions
        self.free_association_text = free_association_text
        self.inquiry_text = inquiry_text
        self.final_coding_json = final_coding_json
        self.ai_coding_json = ai_coding_json
        self.coding_stale_at = coding_stale_at


class _Card:
    def __init__(self, card_no, status):
        self.card_no = card_no
        self.status = status


def _full_cards(status="responded"):
    return [_Card(n, status) for n in CARD_NUMBERS]


def _full_responses(**kwargs):
    return [_Response(card_no=n, **kwargs) for n in CARD_NUMBERS]


class TestResponseRecorded:
    """실시 관점 — 텍스트·영역·질문 답변 **세 칸 모두**가 있어야 한다."""

    def test_all_three_present(self):
        assert response_recorded(_Response()) is True

    def test_no_text(self):
        # 생성 시엔 빈 텍스트를 허용한다(줄을 먼저 만든다) — 여기서 잡는다.
        # 안 잡으면 내용 없는 반응이 R에는 들어가고 채점 입력은 빈 채로 확정된다.
        assert response_recorded(_Response(free_association_text="")) is False
        assert response_recorded(_Response(free_association_text="  ")) is False

    def test_no_region(self):
        # 위치를 안 물어봤다. 채점이 형태(F)로만 치우친다.
        assert response_recorded(_Response(regions=0)) is False

    def test_no_inquiry(self):
        assert response_recorded(_Response(inquiry_text="")) is False

    def test_whitespace_inquiry_is_empty(self):
        # 공백만 있는 것은 안 적은 것이다.
        assert response_recorded(_Response(inquiry_text="   ")) is False

    def test_limits_testing_exempt(self):
        # 한계검증은 채점 대상이 아니므로 실시 완료를 막지 않는다(§14-9).
        assert (
            response_recorded(
                _Response(
                    is_formal=False,
                    regions=0,
                    free_association_text="",
                    inquiry_text="",
                )
            )
            is True
        )


class TestResponseCoded:
    """채점 관점 — **임상가가 저장했는가.** AI 초안은 확정이 아니다(§14-4)."""

    def test_ai_draft_alone_is_not_coded(self):
        r = _Response(ai_coding_json={"location": "W"}, final_coding_json=None)
        assert response_coded(r) is False

    def test_clinician_saved(self):
        r = _Response(ai_coding_json={"location": "W"}, final_coding_json={"location": "D1"})
        assert response_coded(r) is True

    def test_final_without_ai_is_coded(self):
        # AI 없이 임상가가 직접 채점한 경우.
        assert response_coded(_Response(final_coding_json={"location": "W"})) is True

    def test_limits_testing_exempt(self):
        assert response_coded(_Response(is_formal=False)) is True

    def test_stale_coding_is_not_coded(self):
        """실시로 돌아가 원자료를 고치면 저장된 채점도 완료가 아니다.

        칸은 차 있으므로 값 유무만 보면 통과한다 — 그게 정확히 어긋난 채로
        확정되는 자리다. 채점값은 지우지 않고 게이트에서 막는다.
        """
        r = _Response(
            final_coding_json={"location": "W"},
            coding_stale_at=datetime(2026, 8, 25, 12, 0),
        )
        assert response_coded(r) is False

    def test_stale_coding_named_in_pending(self):
        """막을 뿐 아니라 **이름을 대야** 임상가가 찾아간다(§14-12)."""
        r = _Response(
            card_no=4,
            final_coding_json={"location": "W"},
            coding_stale_at=datetime(2026, 8, 25, 12, 0),
        )
        assert len(uncoded_responses([r])) == 1

    def test_resaving_clears_stale(self):
        """다시 저장하면(`coding_stale_at=None`) 게이트가 열린다."""
        r = _Response(final_coding_json={"location": "W"}, coding_stale_at=None)
        assert response_coded(r) is True

    def test_stale_without_final_still_uncoded(self):
        """초안만 있는 반응은 낡음 여부와 무관하게 미채점이다."""
        r = _Response(
            ai_coding_json={"location": "W"},
            final_coding_json=None,
            coding_stale_at=datetime(2026, 8, 25, 12, 0),
        )
        assert response_coded(r) is False

    def test_uncoded_list_names_them(self):
        responses = [
            _Response(card_no=2, response_no=3, final_coding_json=None),
            _Response(card_no=5, response_no=1, final_coding_json={"location": "W"}),
        ]
        pending = uncoded_responses(responses)
        # 이름의 번호는 저장 서열이 아니라 **화면 번호**다. 카드 2에 이 반응
        # 하나뿐이므로 sort_seq가 3이어도 화면에는 1번으로 보인다.
        nos = display_numbers(responses)
        assert [describe_response(r, nos.get(r.id)) for r in pending] == ["카드 2 - 반응 1"]


class TestCardRecorded:
    def test_rejected_card_needs_no_response(self):
        # 제시했으나 반응이 없었다 — 반응 0개가 정상이다.
        assert card_recorded(7, [_Card(7, "rejected")], []) is True

    def test_pending_is_not_recorded(self):
        # "안 물어본 카드"와 "물었지만 반응이 없던 카드"는 R 판정에서 다르다.
        assert card_recorded(7, [_Card(7, "pending")], []) is False

    def test_missing_card_record_is_pending(self):
        assert card_recorded(7, [], []) is False

    def test_responded_without_response_is_incomplete(self):
        # 반응을 지우면 생길 수 있는 상태.
        assert card_recorded(5, [_Card(5, "responded")], []) is False

    def test_one_incomplete_response_fails_the_card(self):
        responses = [
            _Response(card_no=3, response_no=1),
            _Response(card_no=3, response_no=2, regions=0),
        ]
        assert card_recorded(3, [_Card(3, "responded")], responses) is False


class TestAdministrationDone:
    """`collect_done`의 새 정의 (§14-11)."""

    def test_all_ten_complete(self):
        assert administration_done(_full_cards(), _full_responses()) is True
        assert unfinished_cards(_full_cards(), _full_responses()) == []

    def test_names_the_unfinished_card(self):
        # 이름을 대는 것이 게이트보다 중요하다 — 안 대면 찾을 방법이 없다.
        responses = _full_responses()
        responses[2].region_ids = []
        assert unfinished_cards(_full_cards(), responses) == [3]

    def test_missing_card_is_unfinished(self):
        cards = [_Card(n, "responded") for n in range(1, 10)]
        assert unfinished_cards(cards, _full_responses()) == [10]

    def test_rejected_cards_count_as_done(self):
        cards = [_Card(n, "rejected" if n == 7 else "responded") for n in CARD_NUMBERS]
        responses = [r for r in _full_responses() if r.card_no != 7]
        assert administration_done(cards, responses) is True

    def test_empty_session_is_not_done(self):
        assert administration_done([], []) is False
        assert unfinished_cards([], []) == list(CARD_NUMBERS)

    def test_limits_testing_does_not_complete_a_card(self):
        # 한계검증만 있는 카드는 정식 반응이 없으므로 미완이다.
        cards = [_Card(1, "responded")]
        responses = [_Response(card_no=1, is_formal=False)]
        assert card_recorded(1, cards, responses) is False


class TestProgressUsesTheSameRule:
    """progress.py가 completion과 같은 답을 내야 한다.

    두 곳이 어긋나면 "완료 처리는 됐는데 진행 표시는 미완"이 생긴다.
    """

    def test_collect_done_matches_administration_done(self):
        from app.modules.examination.common.progress import rorschach_collect_done

        class _Session:
            ended_at = None

        cards, responses = _full_cards(), _full_responses()
        assert rorschach_collect_done(_Session(), cards, responses) is True

        responses[4].inquiry_text = ""
        assert rorschach_collect_done(_Session(), cards, responses) is False

    def test_falls_back_to_ended_at_without_data(self):
        # 반응까지 읽지 않는 경로(목록 화면 등)를 위한 완화 경로.
        from app.modules.examination.common.progress import rorschach_collect_done

        class _Session:
            ended_at = "2026-08-24"

        assert rorschach_collect_done(_Session()) is True

    def test_collected_count_reports_progress(self):
        from app.modules.examination.common.progress import rorschach_progress

        class _Session:
            ended_at = None

        responses = _full_responses()
        responses[0].region_ids = []
        responses[1].region_ids = []
        p = rorschach_progress(
            _Session(), has_scored_response=False,
            cards=_full_cards(), responses=responses,
        )
        assert p.collected_count == 8
        assert p.collect_total == 10
        assert p.collect_done is False


class TestLocationCodeValidation:
    """위치 부호는 저장 전에 검증한다 (§14-6).

    `parse_location`이 못 읽는 값은 구조요약 집계에서 조용히 사라진다.
    채점이 못 읽을 값을 애초에 받지 않는다.
    """

    @pytest.mark.parametrize("code", ["W", "D6", "DS6", "Dd99", "Dds30", "DdS26"])
    def test_accepts_valid(self, code):
        from app.modules.examination.rorschach.coding_codes import is_valid_location

        assert is_valid_location(code) is True

    @pytest.mark.parametrize("code", ["SD6", "D6S", "XYZ", "S"])
    def test_rejects_invalid(self, code):
        from app.modules.examination.rorschach.coding_codes import is_valid_location

        assert is_valid_location(code) is False

    def test_empty_is_allowed(self):
        # 아직 안 정한 상태다.
        from app.modules.examination.rorschach.coding_codes import is_valid_location

        assert is_valid_location(None) is True
        assert is_valid_location("") is True

    def test_space_marker_is_split_not_separate(self):
        # S는 붙는 것이지 단독 부호가 아니다 — UI가 체크박스인 이유다.
        from app.modules.examination.rorschach.coding_codes import parse_location

        assert parse_location("DS6") == ("D", True)
        assert parse_location("D6") == ("D", False)


class TestDisplayNumbers:
    """표시 번호 파생 — 이번 변경의 핵심.

    무엇을 막는가: `response_no`가 저장 컬럼이던 시절, 삭제가 재배열을 안 해서
    1번을 지우면 화면에 2,3만 남았다. 실데이터에 결번 4건과 **중복 1건**
    (`[…,10,10,11]`)까지 생겼고, 중복은 정렬을 비결정적으로 만들어 표시 번호가
    새로고침마다 바뀔 수 있었다.
    """

    def test_카드마다_1부터_다시_센다(self):
        rs = [
            _Response(card_no=1, response_no=1),
            _Response(card_no=1, response_no=2),
            _Response(card_no=3, response_no=1),
        ]
        nos = display_numbers(rs)
        assert [nos[r.id] for r in rs] == [1, 2, 1]

    def test_간이_벌어져도_화면은_1부터_연속이다(self):
        """1번을 지운 상태 — 저장 서열은 2,3인데 화면은 1,2여야 한다."""
        rs = [
            _Response(card_no=1, response_no=2),
            _Response(card_no=1, response_no=3),
        ]
        assert sorted(display_numbers(rs).values()) == [1, 2]

    def test_서열이_중복돼도_결정적이다(self):
        """저장값이 겹치면 created_at → id로 갈린다. 순서가 흔들리면 안 된다."""
        a = _Response(card_no=1, response_no=10, id="a", created_at=1)
        b = _Response(card_no=1, response_no=10, id="b", created_at=2)
        first = display_numbers([a, b])
        second = display_numbers([b, a])  # 입력 순서를 바꿔도
        assert first == second
        assert first[a.id] == 1 and first[b.id] == 2

    def test_한계검증도_함께_센다(self):
        """정식 반응만 세면 화면(전체를 보여준다)과 번호가 갈린다."""
        rs = [
            _Response(card_no=1, response_no=1),
            _Response(card_no=1, response_no=2, is_formal=False),
            _Response(card_no=1, response_no=3),
        ]
        assert [display_numbers(rs)[r.id] for r in rs] == [1, 2, 3]

    def test_서열이_없어도_터지지_않는다(self):
        rs = [_Response(card_no=1, response_no=None, id="x")]
        assert display_numbers(rs)["x"] == 1
