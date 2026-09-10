"""완료 판정 — 반응 / 카드 / 실시 / 확정 (문서 §14-4, §14-11, §14-12).

**왜 한 파일에 모으는가.** `coding_codes.py`와 같은 이유다. 완료 규칙은 지금
네 곳에서 필요하다 — 실시 완료(CompleteSession), 진행 표시(progress.py),
확정 게이트(ConfirmSession), 그리고 화면. 각자 규칙을 가지면 어긋나도
아무도 모른다. 실제로 그렇게 어긋나 있었다:

- `ConfirmSession`은 반응을 순회하는데(§7) 프론트 `canConfirm`은 영역을 순회했다
  → 영역이 0개인 반응은 검사를 아예 안 받고 확정을 통과했다
- `rorschach_collect_done`은 `ended_at`만 봤는데, `CompleteSessionService`는
  아무것도 검사하지 않고 그 값을 찍었다 → "버튼을 눌렀다"가 "다 채웠다"로 통했다

판정 함수는 ORM 객체를 받되 **쿼리하지 않는다.** 호출자가 필요한 것을 이미
읽어온 상태에서 순수 판정만 한다 — 그래야 테스트가 DB 없이 돌고, 서비스가
N+1을 만들지 않는다.
"""

from typing import Iterable

# 카드는 10장 고정. 로르샤하 표준이며 늘어나지 않는다.
CARD_NUMBERS = tuple(range(1, 11))

#: 카드 번호 → 로마숫자. 임상가는 "카드 3"이 아니라 "카드 III"이라고 부른다.
_CARD_ROMAN = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")


def card_label(card_no: int) -> str:
    """카드 이름. **범위 밖이면 숫자를 그대로 낸다 — 다른 카드 이름을 대지 않는다.**

    같은 표가 세 벌 있었고(오류 메시지 · PDF · AI 요청), **경계에서 셋이 서로
    달랐다**(2026-08-26):

        오류 메시지  `_CARD_LABELS[no]`          → KeyError
        PDF          `… if 1 <= cn <= 10 else str(cn)` → "11"
        AI 요청      `.get(card_no, "I")`        → **"I"**

    마지막 것이 나쁘다. 범위 밖 카드를 **카드 I이라고 AI에 보낸다** — 모름을
    값처럼 내보내는 자리다. 지금은 스키마가 `ge=1, le=10`으로 막고 있어 닿지
    않지만, 막는 쪽이 느슨해지는 순간 조용히 틀린 카드로 채점된다.

    셋 중 안전한 쪽으로 모은다: 숫자는 틀린 이름이 아니라 "이름을 못 붙였다"는
    표시다.
    """
    if 1 <= card_no <= 10:
        return _CARD_ROMAN[card_no - 1]
    return str(card_no)


def response_sort_key(response) -> tuple:
    """반응 정렬 키 — **결정적이어야 한다.**

    `sort_seq`만으로 정렬하면 값이 겹칠 때 순서가 매번 달라진다. 실데이터에
    이미 중복이 있었고(`[…,10,10,11]`), 그러면 표시 번호가 새로고침마다
    뒤바뀐다. `created_at`으로 한 번, `id`로 다시 한 번 갈라 완전히 고정한다.
    """
    return (
        getattr(response, "sort_seq", None) or 0,
        getattr(response, "created_at", None) or 0,
        getattr(response, "id", ""),
    )


def display_numbers(responses: Iterable) -> dict[str, int]:
    """반응 id → 화면에 보이는 번호. **카드마다 1부터 다시 센다.**

    표시 번호를 저장하지 않고 매번 파생시키는 이유는, 저장하면 그 값과 실제
    행 순서가 두 곳이 되어 삭제할 때 갈라지기 때문이다(models.py `sort_seq` 참조).
    파생하면 무엇을 지우든 남은 것이 늘 1..n이다.

    **이 함수가 표시 번호의 유일한 출처다.** API DTO도, 오류 메시지도 여기서
    받아야 한다 — 화면에는 "반응 2"인데 오류 메시지에는 "반응 3"이 뜨면
    임상가가 어느 반응인지 못 찾는다.

    정식 반응이 아닌 것(한계검증)도 함께 센다. 화면에 같이 보이므로 번호가
    없으면 무엇을 가리키는지 말할 수 없다.
    """
    by_card: dict[int, list] = {}
    for r in responses:
        by_card.setdefault(getattr(r, "card_no", 0), []).append(r)

    numbers: dict[str, int] = {}
    for card_responses in by_card.values():
        card_responses.sort(key=response_sort_key)
        for i, r in enumerate(card_responses, start=1):
            numbers[getattr(r, "id", "")] = i
    return numbers

# 실시가 끝난 카드의 상태. pending(미실시)은 여기 없다 —
# "안 물어본 카드"와 "물었지만 반응이 없던 카드"는 R 판정에서 다르게 취급된다.
ADMINISTERED_STATUSES = frozenset({"responded", "rejected"})


def response_recorded(response) -> bool:
    """실시 관점의 완료 — 이 반응에 물어볼 것을 다 물었는가.

    세 칸이 **모두** 채워져야 한다:
      자유반응 텍스트 — 무엇으로 봤나
      영역           — 어디를 봤나
      질문 답변      — 무엇을 보고 그렇게 생각했나

    하나만 있으면 채점이 형태(F)로만 치우친다.

    ⚠️ **자유반응 텍스트를 여기서 검사하는 이유.** 생성 시점에는 빈 값을
    허용한다(§14-2: 줄을 먼저 만들고 내용을 나중에 적는다). 입력을 조이지
    않는 대신 완료 시점에 잡아야 하고, 안 잡으면 내용 없는 반응이 R에는
    들어가고 채점 입력은 빈 채로 확정된다.

    ⚠️ `region_ids`가 아니라 `regions`를 센다 — 호출자가 조각을 이미 읽어온
    경우를 위해 `_region_count`가 두 형태를 모두 받는다.
    """
    if not getattr(response, "is_formal", True):
        # 한계검증은 채점 대상이 아니므로 실시 완료 판정에서 빠진다(§14-9).
        return True
    if not (getattr(response, "free_association_text", None) or "").strip():
        return False
    if _region_count(response) == 0:
        return False
    return bool((getattr(response, "inquiry_text", None) or "").strip())


def response_coded(response) -> bool:
    """채점 관점의 완료 — **임상가가 확인하고 저장했는가** (§14-4).

    `ai_coding_json`이 아니라 `final_coding_json`을 본다. AI가 무엇을 했든
    사람이 저장을 눌러야 채워지는 칸이기 때문이다.

    예전에는 "반응이 존재하면 완료"로 봤는데, AI 채점만 해도 반응은 존재한다.
    그래서 임상가가 한 번도 안 본 AI 초안이 확정을 통과했다 — CDSS 원칙
    (AI 초안 → 임상가 확인)이 깨진 자리다.

    **낡은 채점은 완료가 아니다.** 실시로 돌아가 원자료를 고치면 저장된 채점은
    없어진 근거 위에 서 있는데, 칸은 차 있으므로 값 유무만으로는 통과한다.
    `coding_stale_at`이 서 있는 동안은 미완으로 친다 — 임상가가 그 반응을 다시
    저장해야(유지든 수정이든) 게이트가 열린다.

    ⚠️ 이 함수가 **확정 게이트와 화면 진행률의 유일한 정의**다. 프론트의
    `isCoded`도 같은 규칙이어야 한다 — 두 곳이 갈리면 버튼은 켜지는데 저장이
    거부된다.
    """
    if not getattr(response, "is_formal", True):
        return True
    if getattr(response, "final_coding_json", None) is None:
        return False
    return getattr(response, "coding_stale_at", None) is None


def card_recorded(card_no: int, cards: Iterable, responses: Iterable) -> bool:
    """카드 하나의 실시가 끝났는가.

    두 조건 중 하나다:
    - 거부(rejected) — 제시했으나 반응이 없었다. 반응 0개가 정상이다.
    - 실시(responded) + 그 카드의 모든 정식 반응이 `response_recorded`

    status가 responded인데 반응이 0개면 False다. 서버가 반응 생성 시
    status를 바꾸므로 정상 경로에서는 생기지 않지만, 반응을 지우면 생긴다.
    """
    status = _status_of(card_no, cards)
    if status == "rejected":
        return True
    if status != "responded":
        return False

    card_responses = [r for r in responses if getattr(r, "card_no", None) == card_no]
    formal = [r for r in card_responses if getattr(r, "is_formal", True)]
    if not formal:
        return False
    return all(response_recorded(r) for r in formal)


def unfinished_cards(cards: Iterable, responses: Iterable) -> list[int]:
    """아직 실시가 안 끝난 카드 번호들. 순서를 보존한다.

    **이름을 대는 것이 게이트보다 중요하다.** 반응 25개 중 하나가 빠졌을 때
    버튼만 비활성이면 임상가는 찾을 방법이 없다(§14-12).
    """
    return [no for no in CARD_NUMBERS if not card_recorded(no, cards, responses)]


def administration_done(cards: Iterable, responses: Iterable) -> bool:
    """실시 전체가 끝났는가 — `collect_done`의 새 정의 (§14-11).

    10장 전부 실시/거부 **AND** 모든 정식 반응이 영역 + 질문 답변 보유.

    v4까지는 `session.ended_at is not None`이었다. 그건 버튼을 눌렀다는
    뜻이지 내용이 채워졌다는 뜻이 아니었고, 자유반응/질문 화면이 합쳐지면서
    (§14-1) 중간 게이트가 사라졌으므로 여기서 실제로 검사해야 한다.
    """
    return not unfinished_cards(cards, responses)


def uncoded_responses(responses: Iterable) -> list:
    """확정을 막는 반응들 — 임상가가 저장하지 않은 정식 반응.

    ConfirmSession이 이걸로 거부 메시지를 만든다.
    """
    return [
        r
        for r in responses
        if getattr(r, "is_formal", True) and not response_coded(r)
    ]


def describe_response(response, display_no: int | None = None) -> str:
    """오류 메시지용 반응 이름 — "카드 3 - 반응 2".

    ⚠️ **`display_no`는 `display_numbers()`가 준 값이어야 한다.** 저장된
    `sort_seq`를 넘기면 화면과 다른 번호를 대게 되고, 임상가는 "카드 3 - 반응 4"를
    찾으러 갔다가 그런 게 없는 걸 보게 된다. 정확히 이 어긋남을 막으려고
    표시 번호를 한 곳에서만 만든다.

    번호를 모르면 '?'로 둔다. 이름을 못 대는 것보다 낫다.
    """
    card = getattr(response, "card_no", None) or "?"
    no = display_no or "?"
    return f"카드 {card} - 반응 {no}"


# --- 내부 헬퍼 ---


def _status_of(card_no: int, cards: Iterable) -> str:
    """카드 실시 기록의 status. 기록이 없으면 pending."""
    for c in cards:
        if getattr(c, "card_no", None) == card_no:
            return getattr(c, "status", "pending") or "pending"
    return "pending"


def _region_count(response) -> int:
    """반응에 달린 조각 수.

    ORM 관계(`regions`)와 DTO(`region_ids`) 양쪽을 받는다 — 서비스는 모델을,
    화면 응답을 만드는 쪽은 id 목록을 갖고 있어서다. 둘 중 있는 것을 쓴다.
    """
    regions = getattr(response, "regions", None)
    if regions is not None:
        return sum(1 for g in regions if getattr(g, "deleted_at", None) is None)
    return len(getattr(response, "region_ids", None) or [])
