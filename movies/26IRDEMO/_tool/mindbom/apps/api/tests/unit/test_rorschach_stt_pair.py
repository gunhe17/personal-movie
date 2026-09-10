"""STT 원문/확정본은 **쌍이다** — 자유반응에만 지켜지고 질문 답변엔 아니었다.

무엇을 막는 테스트인가
----------------------
§4-2의 원칙: 기계가 들은 것(`*_stt_raw`)과 임상가가 확정한 것(`*_text`)을
따로 남긴다. 그래야 "무엇을 고쳤나"를 대조할 수 있고, 검토가 승인으로
무너지지 않는다.

자유반응은 그 쌍이 살아 있었다. 질문 답변은 **모델에 칸만 있고 아무도 쓰지
않았다**(2026-08-26 발견):

- `ResponseUpdate`에 `inquiry_stt_raw` 필드 자체가 없어 받을 수가 없었다
- `ResponseDetail`도 안 내보내 화면이 읽을 수가 없었다
- 그런데 화면(`FreeAssociation.appendInquiry`)의 주석은 **"`inquiry_stt_raw`도
  같이 채운다"고 적혀 있었다** — 죽은 칸보다 나쁘다. 읽는 사람이 그 말을 믿는다.

두 칸이 나란해야 한다는 것을 스키마 수준에서 고정한다. 한쪽만 늘리거나
한쪽만 지우면 여기서 터진다.
"""
import pytest

from app.modules.examination.rorschach.schemas import ResponseDetail, ResponseUpdate

#: (자유반응 칸, 질문 칸) — 같은 규칙을 따라야 하는 쌍
PAIRS = [
    ("free_association_text", "inquiry_text"),
    ("free_association_stt_raw", "inquiry_stt_raw"),
]


@pytest.mark.parametrize("schema", [ResponseUpdate, ResponseDetail])
@pytest.mark.parametrize("free_field,inquiry_field", PAIRS)
def test_두_단계가_같은_칸을_갖는다(schema, free_field, inquiry_field):
    fields = schema.model_fields
    assert free_field in fields, f"{schema.__name__}에 {free_field}가 없다"
    assert inquiry_field in fields, (
        f"{schema.__name__}에 {inquiry_field}가 없다 — 자유반응에만 있는 칸은 "
        "§4-2가 한쪽만 지켜진 상태다"
    )


@pytest.mark.parametrize("free_field,inquiry_field", PAIRS)
def test_쌍의_타입이_같다(free_field, inquiry_field):
    fields = ResponseUpdate.model_fields
    assert fields[free_field].annotation == fields[inquiry_field].annotation


def test_수정_요청이_질문_원문을_실어_보낼_수_있다():
    """실제로 값이 통과하는지 — 필드 존재만으로는 부족하다."""
    body = ResponseUpdate(inquiry_text="박쥐 날개요", inquiry_stt_raw="박쥐 날게요")
    sent = body.model_dump(exclude_unset=True)
    assert sent == {"inquiry_text": "박쥐 날개요", "inquiry_stt_raw": "박쥐 날게요"}


def test_STT_원문은_채점_근거가_아니다():
    """`_CODING_GROUND_FIELDS`에 들어가면 원문이 도착할 때마다 채점이 낡는다.

    원문은 **대조용 기록**이지 AI·임상가가 읽고 부호를 정한 자료가 아니다
    (그건 `*_text`다). 새 칸을 근거 목록에 잘못 넣으면 전사가 이어붙을 때마다
    이미 저장한 채점이 전부 '재검토 필요'로 뒤집힌다.
    """
    from app.modules.examination.rorschach.services import _CODING_GROUND_FIELDS

    assert "inquiry_stt_raw" not in _CODING_GROUND_FIELDS
    assert "free_association_stt_raw" not in _CODING_GROUND_FIELDS
    assert "inquiry_text" in _CODING_GROUND_FIELDS
