"""SCT 청소년용 40문항 stem 데이터

5개 영역(A~E) 분배. AI 추론 서버(`sct-inference-v1`)의 `app/stems.py`와
문항 텍스트·도메인 배정·복합문항 ID를 1:1로 동기화한다. 양쪽 stems 정의가
어긋나면 LLM이 잘못된 도메인 맥락에서 채점하므로, 변경 시 양쪽을 함께 갱신할 것.
"""

DOMAIN_LABELS: dict[str, str] = {
    "A": "가족 관계",
    "B": "또래·사회 관계",
    "C": "정서·대처",
    "D": "자기 인식",
    "E": "학교 적응·미래 열망",
}

# 복합문항: 답변 + "왜냐하면" reason 필드 추가 입력 받음
COMPOUND_STEM_IDS: set[int] = {22, 28, 31}


STEMS: list[dict] = [
    {"id": 1, "domain": "A", "stem": "어렸을 때 우리 집은"},
    {"id": 2, "domain": "B", "stem": "친구들은"},
    {"id": 3, "domain": "D", "stem": "나는"},
    {"id": 4, "domain": "B", "stem": "여자애들은"},
    {"id": 5, "domain": "A", "stem": "우리 엄마는"},
    {"id": 6, "domain": "E", "stem": "내가 가장 갖고 싶은 것은"},
    {"id": 7, "domain": "B", "stem": "선생님들은"},
    {"id": 8, "domain": "A", "stem": "집에 있을 때 나는"},
    {"id": 9, "domain": "C", "stem": "나를 가장 즐겁게 하는 것은"},
    {"id": 10, "domain": "D", "stem": "친구들이 잘 모르는 나의 단점은"},
    {"id": 11, "domain": "A", "stem": "우리 가족은"},
    {"id": 12, "domain": "D", "stem": "내가 가장 잘하는 것은"},
    {"id": 13, "domain": "C", "stem": "내가 사랑받는다고 느낄 때는"},
    {"id": 14, "domain": "A", "stem": "우리 아빠는"},
    {"id": 15, "domain": "E", "stem": "나의 학교생활은"},
    {"id": 16, "domain": "C", "stem": "내가 가장 두려워하는 것은"},
    {"id": 17, "domain": "B", "stem": "어른들은"},
    {"id": 18, "domain": "D", "stem": "내 외모는"},
    {"id": 19, "domain": "C", "stem": "나를 슬프게 하는 것은"},
    {"id": 20, "domain": "E", "stem": "공부하는 것은"},
    {"id": 21, "domain": "C", "stem": "요즘 제일 걱정이 되는 것은"},
    {"id": 22, "domain": "B", "stem": "내가 가장 싫어하는 사람은", "isCompound": True},
    {"id": 23, "domain": "C", "stem": "짜증이 날 때 나는"},
    {"id": 24, "domain": "A", "stem": "우리 언니/오빠/누나/형/동생은"},
    {"id": 25, "domain": "A", "stem": "엄마와 나는"},
    {"id": 26, "domain": "A", "stem": "아빠와 나는"},
    {"id": 27, "domain": "B", "stem": "남자애들은"},
    {"id": 28, "domain": "E", "stem": "내가 가장 본받고 싶은 사람은", "isCompound": True},
    {"id": 29, "domain": "E", "stem": "내가 돈을 번다면"},
    {"id": 30, "domain": "C", "stem": "내가 제일 행복할 때는"},
    {"id": 31, "domain": "E", "stem": "이다음에 크면", "isCompound": True},
    {"id": 32, "domain": "D", "stem": "나 자신이 가장 자랑스러울 때는"},
    {"id": 33, "domain": "B", "stem": "친구들은 나에 대해"},
    {"id": 34, "domain": "A", "stem": "부모님은 나에 대해"},
    {"id": 35, "domain": "D", "stem": "내가 만일"},
    {"id": 36, "domain": "E", "stem": "나의 미래는"},
    {"id": 37, "domain": "C", "stem": "내가 가장 화가 날 때는"},
    {"id": 38, "domain": "B", "stem": "세상은"},
    {"id": 39, "domain": "D", "stem": "내가 제일 좋아하는 친구는"},
    {"id": 40, "domain": "D", "stem": "고치고 싶은 나쁜 습관은"},
]

assert len(STEMS) == 40, "SCT는 40문항이어야 합니다"
assert {s["domain"] for s in STEMS} == set(DOMAIN_LABELS.keys()), "도메인 매핑 오류"


STEMS_BY_ID: dict[int, dict] = {s["id"]: s for s in STEMS}


def get_stems_with_labels() -> list[dict]:
    """프론트 응답용 — domainLabel 포함"""
    return [
        {**s, "domainLabel": DOMAIN_LABELS[s["domain"]]}
        for s in STEMS
    ]
