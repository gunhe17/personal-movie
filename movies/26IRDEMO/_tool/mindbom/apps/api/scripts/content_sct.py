"""SCT 촬영용 내용물 — 40문항 응답과 영역별 점수.

SCT는 **전용 테이블이 없다.** 응답도 채점도 `examinations.result_data`(JSONB)
한 칸에 들어간다(`sct/services.py`). 그래서 여기서 만드는 것도 그 dict 하나다.

점수는 0~6이고 **높을수록 갈등**이다(`ai/remote.py`가 높은 영역을 "갈등 수준이
높다"로 요약한다). 아래 값은 가족·정서 영역이 높은 형태 — 우울감으로 내원한
성인의 프로파일을 흉내낸 것이지 실제 채점 결과가 아니다.

⚠️ 한 벌만 만든다. ponytail: 내담자마다 다른 답변을 쓰면 400줄이 되는데,
   화면에 두 사람의 SCT가 나란히 서는 컷이 대본에 없다. 필요해지면 그때 나눈다.
"""
from __future__ import annotations

from app.modules.examination.sct.stems import (
    COMPOUND_STEM_IDS,
    DOMAIN_LABELS,
    STEMS,
)

# stem_id → (answer, reason|None, score)
ANSWERS: dict[int, tuple[str, str | None, int]] = {
    1: ("조용했지만 서로 속마음은 잘 몰랐다", None, 4),
    2: ("몇 명 안 되지만 오래 같이 논 애들이다", None, 2),
    3: ("생각이 많고 잘 지치는 편이다", None, 4),
    4: ("잘 챙겨주는 애들이 많다", None, 1),
    5: ("늘 걱정이 많고 잔소리를 많이 하신다", None, 4),
    6: ("아무것도 안 해도 되는 하루", None, 3),
    7: ("기대를 하셔서 부담될 때가 있다", None, 3),
    8: ("말을 잘 안 하고 방에 혼자 있는다", None, 5),
    9: ("쉬는 시간에 운동장에 나가는 것", None, 1),
    10: ("속으로 오래 담아두는 것", None, 4),
    11: ("같이 살지만 각자 따로 지낸다", None, 5),
    12: ("한번 시작하면 끝까지 하는 것", None, 1),
    13: ("말 안 해도 알아줄 때", None, 2),
    14: ("말수가 적지만 약속은 지키신다", None, 3),
    15: ("그냥 무난하고 별일이 없다", None, 2),
    16: ("계속 이대로 아무것도 안 바뀌는 것", None, 5),
    17: ("바빠서 잘 안 물어보신다", None, 2),
    18: ("마음에 들지도 싫지도 않다", None, 2),
    19: ("애쓴 걸 아무도 몰라줄 때", None, 5),
    20: ("해야 하니까 하는 것이다", None, 3),
    21: ("이러다 아무한테도 말 못 하게 될까 봐", None, 5),
    22: ("남 탓만 하는 애", "결국 옆에 있는 애가 대신 혼나니까", 3),
    23: ("아무 말도 안 하고 그 자리를 피한다", None, 4),
    24: ("자주 싸우지만 챙겨주기도 한다", None, 2),
    25: ("서로 조심하느라 할 말을 못 한다", None, 5),
    26: ("필요한 말만 짧게 한다", None, 4),
    27: ("시끄럽지만 나쁘지는 않다", None, 1),
    28: ("힘들어도 티 안 내는 사람", "나는 조금만 힘들어도 도망치고 싶어지니까", 3),
    29: ("엄마한테 드리고 나머지는 모아두고 싶다", None, 3),
    30: ("다음 날 걱정 없이 잠들 때", None, 4),
    31: ("지금보다 덜 힘들게 살고 싶다", "계속 이렇게 참기만 하면 못 견딜 것 같아서", 4),
    32: ("그만두고 싶었는데 끝까지 했을 때", None, 2),
    33: ("잘 참는 애라고 한다", None, 2),
    34: ("알아서 잘하는 애라고 생각하신다", None, 4),
    35: ("다시 할 수 있다면 더 빨리 말할 걸 그랬다", None, 3),
    36: ("잘 그려지지 않는다", None, 5),
    37: ("이해받지 못한다고 느낄 때", None, 4),
    38: ("무섭기도 하고 가끔 좋기도 하다", None, 2),
    39: ("말없이 옆에 있어주는 애", None, 1),
    40: ("혼자 참다가 한 번에 터뜨리는 것", None, 4),
}

assert set(ANSWERS) == {s["id"] for s in STEMS}, "stem 목록과 답변이 어긋난다"

OVERALL_SUMMARY = (
    "가족 관계와 정서·대처 영역에서 상대적으로 높은 갈등 수준이 시사된다. "
    "정서를 표현하기보다 혼자 감내하는 대처가 반복되며, 미래 조망이 뚜렷하지 않다. "
    "또래·사회 관계 영역은 비교적 안정적인 범위로 나타난다."
)


def _iso(dt) -> str:
    return dt.replace(microsecond=0).isoformat()


def result_data(answered_at, *, limit: int | None = None, scored: bool = True) -> dict:
    """result_data 한 벌.

    limit  응답을 앞에서 N문항만 채운다(진행 중 화면용). None이면 전부.
    scored 채점 결과(scores)를 넣는가. 실시 중인 검사는 넣지 않는다.
    """
    stems = STEMS if limit is None else STEMS[:limit]
    responses = [
        {
            "stemId": s["id"],
            "answer": ANSWERS[s["id"]][0],
            "reason": ANSWERS[s["id"]][1] if s["id"] in COMPOUND_STEM_IDS else None,
            "answeredAt": _iso(answered_at),
        }
        for s in stems
    ]
    data: dict = {
        "responses": responses,
        "totalCount": len(STEMS),
        "completedCount": len(responses),
    }
    if not scored:
        return data

    by_domain: dict[str, list[dict]] = {}
    for s in STEMS:
        answer, reason, score = ANSWERS[s["id"]]
        by_domain.setdefault(s["domain"], []).append({
            "stemId": s["id"],
            "stem": s["stem"],
            "score": score,
            "answer": answer,
            "reason": reason if s["id"] in COMPOUND_STEM_IDS else None,
        })
    data["scores"] = [
        {
            "domain": d,
            "domainLabel": DOMAIN_LABELS[d],
            "totalScore": sum(i["score"] for i in items),
            "maxScore": len(items) * 6,
            "items": items,
        }
        for d, items in sorted(by_domain.items())
    ]
    data["overallSummary"] = OVERALL_SUMMARY
    return data
