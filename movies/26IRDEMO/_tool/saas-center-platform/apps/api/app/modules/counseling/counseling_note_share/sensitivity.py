# 공유문에 남은 민감 표현 탐지 — 발행 직전 상담사에게 무엇이 걸렸는지 알리는 용도.
#
# 판정 대상은 원문이 아니라 **공유문**이다. 원문에 자해 언급이 있어도 변환에서 빠졌으면
# 경고할 이유가 없고, 공유문에 남았을 때만 되돌릴 수 없는 노출이 된다.
# 차단이 아니라 고지다 — 공유가 옳은 케이스(보호자가 알아야 안전을 지키는 상황)가 있어
# 판단은 상담사가 한다.
#
# 어휘는 현장 검토 전 초안이다. 미탐(걸려야 할 게 통과)이 오탐보다 훨씬 비싸므로 넓게 잡는다.

_CATEGORIES: dict[str, tuple[str, ...]] = {
    "자해·자살 관련": (
        "자해", "자살", "극단적 선택", "죽고 싶", "죽고싶", "손목", "유서",
        "안전계획", "자상", "목을 매", "약을 모아",
    ),
    "학대·폭력 관련": (
        "학대", "방임", "성추행", "성폭력", "가정폭력", "폭행", "체벌",
        "신고 의무", "아동보호",
    ),
    "본인이 알리지 않기를 원한 내용": (
        "비밀보장", "비밀 보장", "알리지 말", "말하지 말", "비밀로",
        "엄마 알면", "아빠 알면", "부모님 알면",
    ),
    "약물·중독 관련": ("음주", "흡연", "약물", "중독", "도박"),
}


def detect_sensitive_categories(content: dict | None) -> list[str]:
    if not content:
        return []
    text = " ".join(
        value for value in content.values() if isinstance(value, str) and value
    )
    if not text:
        return []
    return [
        label
        for label, terms in _CATEGORIES.items()
        if any(term in text for term in terms)
    ]
