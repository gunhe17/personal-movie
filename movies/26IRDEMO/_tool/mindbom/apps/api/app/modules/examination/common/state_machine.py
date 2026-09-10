"""검사 상태 머신 — SaMD CDSS 워크플로우

상태 전이:
  created → in_progress → ai_draft_ready
  → under_review → confirmed → report_generated

CDSS 원칙:
  - 초안은 임상가가 검토(under_review)한 뒤 confirmed (확인 완료)
  - 최종 결정은 사람이 한다

여기 있는 것은 **임상 워크플로 축**이다. 검사가 어디까지 진행됐는지
(수집 완료 여부 등)는 progress.py가, AI 분석의 진행·실패·소요시간은
ai_job_models.py가 담당한다.

ai_analyzing이 없는 이유
------------------------
그건 상태가 아니라 작업이었다 — 순간적이고, 반복되고, 실패하고, 어떤
검사에는 아예 없다. 앞으로 붙을 표준화 검사(MMPI·웩슬러 등)는 규준표
기반이라 AI 분석 단계가 없는데, status에 있으면 억지로 통과해야 했다
(SCT가 상태 머신을 우회하던 이유). ai_analysis_jobs 표로 옮겼다.

completed가 없는 이유
---------------------
마인드봄의 일은 report_generated에서 끝난다. 그 뒤의 '완료'는 운영
플랫폼(마인드스코프)이 담당자 검수로 판정하는 별개 사건이라, 같은
이름을 우리 축에 두면 동명이의가 된다 — 자동 매핑하면 사람의 검수가
조용히 사라진다(감사추적 구멍).

준동형 관점에서도 마찬가지다. 우리→플랫폼 사상의 정의역은
report_generated까지이므로, completed는 사상되지 않는 원소였다.
실제로 이 상태를 만드는 코드는 HTP 화면의 '검사 완료' 버튼 하나뿐이었고
(로르샤하·SCT엔 없었다) 백엔드엔 생산자가 아예 없었다.
"""
from app.core.exceptions import InvalidStateTransitionException

# 허용된 상태 전이 맵
VALID_TRANSITIONS: dict[str, list[str]] = {
    "created": ["in_progress"],
    "in_progress": ["ai_draft_ready"],                     # 초안 생성 완료
    "ai_draft_ready": ["under_review", "in_progress"],     # 검토 시작 or 재분석
    "under_review": ["confirmed", "in_progress"],          # 확정 or 재분석 요청
    "confirmed": ["report_generated"],                     # 보고서 생성 단계
    "report_generated": [],                                # 최종 — 이후는 플랫폼 소관
}

# 각 상태의 한글 라벨
STATUS_LABELS: dict[str, str] = {
    "created": "생성됨",
    "in_progress": "검사 진행중",
    "ai_draft_ready": "AI 초안 완료",
    "under_review": "검토중",
    "confirmed": "확인 완료",
    # '완료'라 부르지 않는다 — 플랫폼(마인드스코프)의 completed는 담당자
    # 검수로만 도달하는 별개 사건이라 같은 이름을 쓰면 동명이의가 된다.
    # completed를 상태 머신에서 뺀 것과 같은 논지다(위 docstring 참고).
    # '확인 완료'와도 뚜렷이 갈라진다 — 둘 다 '완료'로 끝나면 필터 목록에서
    # 무엇이 다른지 알 수 없었다.
    "report_generated": "보고서 생성",
}

ALL_STATUSES = list(VALID_TRANSITIONS.keys())


def validate_transition(current_status: str, new_status: str) -> None:
    """상태 전이 유효성 검증

    Raises:
        InvalidStateTransitionException: 허용되지 않은 전이
    """
    if current_status not in VALID_TRANSITIONS:
        raise InvalidStateTransitionException(
            f"알 수 없는 상태: {current_status}"
        )

    allowed = VALID_TRANSITIONS[current_status]
    if new_status not in allowed:
        current_label = STATUS_LABELS.get(current_status, current_status)
        new_label = STATUS_LABELS.get(new_status, new_status)
        allowed_labels = [STATUS_LABELS.get(s, s) for s in allowed]
        raise InvalidStateTransitionException(
            f"'{current_label}' → '{new_label}' 전이 불가. "
            f"허용된 전이: {', '.join(allowed_labels) if allowed_labels else '없음 (최종 상태)'}"
        )


def can_transition(current_status: str, new_status: str) -> bool:
    """전이 가능 여부 (예외 없이 bool 반환)"""
    return new_status in VALID_TRANSITIONS.get(current_status, [])


# 임상가가 확정한 이후의 상태들 — 결과 열람·보고서 발행이 가능한 구간.
#
# 이 집합을 호출부에서 인라인으로 다시 적지 않는다. 프론트에서 같은 배열을
# 재구현했다가 마지막 상태를 빠뜨려, 가장 끝난 검사만 결과를 못 보는 회귀가
# 있었다(core/status.ts isConfirmed 주석). 여기가 백엔드 정본이다.
#
# "completed"는 상태 머신에서 뺐지만 여기에는 남긴다 — 그 값이 들어 있는
# 과거 행이 결과 열람을 잃으면 안 된다. 읽기 판정은 관대하게, 쓰기(전이)는
# 엄격하게. VALID_TRANSITIONS가 새로 만드는 것만 막으면 된다.
CONFIRMED_STATUSES: frozenset[str] = frozenset(
    {"confirmed", "report_generated", "completed"}
)


def is_confirmed(status: str) -> bool:
    """임상가 확정 이후인가 — 결과 열람·PDF 생성의 전제.

    confirmed보다 더 진행된 상태를 포함한다. 빠뜨리면 "가장 끝난 검사만
    결과를 못 보는" 역전이 된다.
    """
    return status in CONFIRMED_STATUSES


def get_next_statuses(current_status: str) -> list[str]:
    """현재 상태에서 전이 가능한 다음 상태 목록"""
    return VALID_TRANSITIONS.get(current_status, [])
