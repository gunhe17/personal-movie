"""표시 번호의 **모집단은 세션 전체다** — 정식 반응만 세면 화면과 갈린다.

무엇을 막는 테스트인가
----------------------
`display_numbers()`의 계약은 "한계검증(is_formal=False)도 함께 센다"이고,
화면(`_build_detail_response`)이 `list_by_session`으로 그렇게 센다.
그런데 채점·확정 쪽은 §7에 따라 `list_formal_by_session`으로 **순회**한다
(R은 정식 반응의 수다). 그 목록을 그대로 `display_numbers()`에 넘기면
모집단이 달라져 **화면에 없는 번호**가 나온다.

`ConfirmSession`과 `GetStructuralSummary`가 그렇게 하고 있었다(2026-08-26).
둘 다 오류 메시지에 반응 이름을 대는 자리다 —
"확정할 수 없습니다 (카드 III 반응 3)"인데 화면엔 그 번호가 없다.
임상가는 고칠 반응을 못 찾고, **어긋났다는 사실도 안 보인다.**

한계검증이 늘 카드의 마지막이면 티가 안 난다. 그러나 `is_formal`은
`ResponseUpdate`로 나중에 뒤집을 수 있어(카드 중간 반응을 한계검증으로
돌리는 순간) 실제로 갈린다. 아래 테스트가 그 상황을 그대로 세운다.
"""
import pytest

from app.modules.examination.rorschach.completion import display_numbers
from app.modules.examination.rorschach.services import _session_display_numbers


class _Response:
    def __init__(self, rid: str, card_no: int, sort_seq: int, is_formal: bool = True):
        self.id = rid
        self.card_no = card_no
        self.sort_seq = sort_seq
        self.created_at = sort_seq
        self.is_formal = is_formal


class _Repo:
    """`list_by_session`(전체)과 `list_formal_by_session`(정식만)을 가른다."""

    def __init__(self, responses):
        self._responses = responses

    async def list_by_session(self, session_id):
        return list(self._responses)

    async def list_formal_by_session(self, session_id):
        return [r for r in self._responses if r.is_formal]


def _mid_card_limits_testing():
    """카드 III: 정식 → **한계검증** → 정식 → 정식.

    한계검증이 가운데 있다. 화면은 이것을 2번으로 세고, 그 뒤 정식 반응들은
    3·4번이다.
    """
    return [
        _Response("a", 3, 1),
        _Response("b", 3, 2, is_formal=False),
        _Response("c", 3, 3),
        _Response("d", 3, 4),
    ]


@pytest.mark.asyncio
async def test_세션_전체를_세므로_화면과_같은_번호가_나온다():
    responses = _mid_card_limits_testing()
    nos = await _session_display_numbers(_Repo(responses), "s1")

    # 화면(`_build_detail_response`)이 만드는 번호와 **글자 하나까지 같아야 한다.**
    assert nos == display_numbers(responses)
    assert [nos["a"], nos["b"], nos["c"], nos["d"]] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_정식만_세던_옛_방식은_뒤쪽_번호가_밀린다():
    """가드가 죽었을 때 무엇이 벌어지는지를 직접 재현한다.

    통과만 보면 가드가 살아 있는지 알 수 없다 — 옛 동작을 나란히 놓고
    **값이 실제로 갈린다**는 것을 고정한다.
    """
    responses = _mid_card_limits_testing()
    repo = _Repo(responses)

    correct = await _session_display_numbers(repo, "s1")
    old = display_numbers(await repo.list_formal_by_session("s1"))  # 옛 방식

    # 한계검증 앞의 반응은 같고, 뒤의 두 반응만 하나씩 밀린다.
    assert old["a"] == correct["a"] == 1
    assert (old["c"], correct["c"]) == (2, 3)
    assert (old["d"], correct["d"]) == (3, 4)
    # 그리고 옛 방식은 한계검증에 번호를 주지 못한다 — 화면엔 보이는데.
    assert "b" not in old


@pytest.mark.asyncio
async def test_한계검증이_카드_마지막이면_두_방식이_같다():
    """왜 오래 안 들켰는지 — 보통은 한계검증이 뒤에 붙어 차이가 안 난다."""
    responses = [
        _Response("a", 3, 1),
        _Response("b", 3, 2),
        _Response("c", 3, 3, is_formal=False),
    ]
    repo = _Repo(responses)

    correct = await _session_display_numbers(repo, "s1")
    old = display_numbers(await repo.list_formal_by_session("s1"))

    assert old["a"] == correct["a"] == 1
    assert old["b"] == correct["b"] == 2


@pytest.mark.asyncio
async def test_카드마다_1부터_다시_센다():
    responses = [
        _Response("a", 1, 1),
        _Response("b", 1, 2, is_formal=False),
        _Response("c", 2, 3),
    ]
    nos = await _session_display_numbers(_Repo(responses), "s1")
    assert [nos["a"], nos["b"], nos["c"]] == [1, 2, 1]
