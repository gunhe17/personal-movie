"""종합보고서 상태 머신 — SaMD CDSS 워크플로우

상태 전이:
  draft → ai_generated → under_review → confirmed → report_generated → completed

CDSS 원칙:
  - AI는 ai_generated까지만 (초안 생성)
  - 임상가가 편집(under_review) 후 confirmed (clinician/admin만)
  - confirmed에서 PDF → report_generated → completed
"""
from app.core.exceptions import InvalidStateTransitionException

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["ai_generated", "under_review"],       # AI 초안은 선택
    "ai_generated": ["under_review", "ai_generated"],  # 재생성 self-loop
    "under_review": ["confirmed", "ai_generated"],     # 확정 or 재생성
    "confirmed": ["report_generated"],
    "report_generated": ["completed", "report_generated"],  # 재출력 허용
    "completed": [],
}

STATUS_LABELS: dict[str, str] = {
    "draft": "초안 작성",
    "ai_generated": "AI 초안 생성됨",
    "under_review": "검토중",
    "confirmed": "확인 완료",
    "report_generated": "보고서 생성됨",
    "completed": "완료",
}

ALL_STATUSES = list(VALID_TRANSITIONS.keys())


def validate_transition(current_status: str, new_status: str) -> None:
    """상태 전이 유효성 검증

    Raises:
        InvalidStateTransitionException: 허용되지 않은 전이
    """
    if current_status not in VALID_TRANSITIONS:
        raise InvalidStateTransitionException(f"알 수 없는 상태: {current_status}")

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


# 임상가가 확정한 이후의 상태들 — PDF 생성이 가능한 구간.
#
# 검사(examination)의 같은 이름 집합과 값이 우연히 겹치지만 별개다 —
# 이쪽 상태 머신에는 draft·ai_generated가 있고 검사에는 없다. 한쪽을
# 고칠 때 다른 쪽이 따라가면 안 되므로 각자 정본을 갖는다.
CONFIRMED_STATUSES: frozenset[str] = frozenset(
    {"confirmed", "report_generated", "completed"}
)


def is_confirmed(status: str) -> bool:
    """임상가 확정 이후인가 — PDF 생성의 전제.

    confirmed보다 더 진행된 상태(report_generated·completed)를 포함한다.
    """
    return status in CONFIRMED_STATUSES
