"""마인드봄 검사 축 → 마인드스코프 플랫폼 사상(homomorphism) 선언.

무엇을 고정하는가
-----------------
플랫폼은 **사건**(assessment_task 이벤트 10종)으로, 우리는 **규칙**
(VALID_TRANSITIONS + validate_transition)으로 검사 진행을 표현한다.
같은 현실을 두 어휘로 적고 있으므로, "어떤 사건이 어떤 전이를 뜻하는가"를
표로 고정하지 않으면 양쪽이 어긋나도 아무도 모른다.

이 파일이 그 표다. 정본은 여기이고, contracts/exam-state.json으로 내보내
양쪽 CI가 같은 데이터를 읽는다.

준동형 조건
-----------
    f(transition(s, e)) = platform_transition(f(s), platform_event(e))

f = STATUS_MAP (우리 상태 → 플랫폼 상태). 좌변은 "우리가 전이한 뒤 사상",
우변은 "사상한 뒤 플랫폼이 전이". 두 값이 같아야 사상이 보존된다.

f의 정의역이 제한되는 이유
--------------------------
`completed`는 동명이의다. 플랫폼의 completed는 담당자 검수 액션으로만
도달하는데, 우리 report_generated를 거기 자동 매핑하면 검수가 일어나지
않았는데 도달해 버린다 — 좌변 ≠ 우변이므로 준동형이 아니고, 감사추적
구멍이다. 그래서 f의 공역은 submitted까지이고 completed는 대응하지 않는다.

용어 주의: 우리 STATUS_LABELS는 report_generated를 "완료"로 표시하지만
이는 UI 라벨일 뿐, 플랫폼 completed와 다른 개념이다.
"""

# --- 플랫폼 측 어휘 (실측: docs/reference/api/app/modules/assessment/assessment_task/) ---

# models.py TaskStatus — String(20), enum 제약 없음
PLATFORM_STATUSES: tuple[str, ...] = (
    "pending",
    "in_progress",
    "submitted",
    "completed",
    "refused",
    "cancelled",
)

# events.py AssessmentTaskAtomic classmethod 10개의 _act 값
PLATFORM_EVENTS: tuple[str, ...] = (
    "created",
    "started",
    "cancelled",
    "refused",
    "updated",
    "submitted",
    "completed",
    "reverted",
    "cancel_reverted",
    "deleted",
)

# 이 두 이벤트는 status를 바꾸지 않는다 — CRUD이지 전이가 아니다.
# 문서(구현방안 §2.2)는 10종을 일괄로 "전이 표현"이라 부르지만, 발행
# 서비스를 실측하면 updated는 changed dict만 싣고 status는 그대로이고,
# deleted는 soft delete다. 전이 사상의 정의역에서 제외해야 한다.
NON_TRANSITION_EVENTS: frozenset[str] = frozenset({"updated", "deleted"})

# 종료 상태 — assessment_case/handlers/complete_assessment_case.py
PLATFORM_TERMINAL_STATUSES: frozenset[str] = frozenset(
    {"completed", "refused", "cancelled"}
)


# --- f: 우리 상태 → 플랫폼 상태 ---

# 4구간(in_progress~confirmed)이 플랫폼 in_progress 하나로 접힌다.
# 접기의 근거: 그 구간 전체가 "제출 전"이고, 검토 주체가 우리 임상가다.
# ai_draft_ready·under_review를 submitted로 보내면 안 된다 — 플랫폼
# submitted는 담당자 검수 대기를 뜻하는데, 우리는 아직 재분석으로
# 되돌아갈 수 있다(ai_draft_ready → in_progress 역전이가 실재한다).
STATUS_MAP: dict[str, str] = {
    "created": "pending",
    "in_progress": "in_progress",
    "ai_draft_ready": "in_progress",
    "under_review": "in_progress",
    "confirmed": "in_progress",
    "report_generated": "submitted",
}

# f의 공역에 없는 플랫폼 상태 — 왜 대응물이 없는지 명시한다.
# 빈칸으로 두면 "아직 안 적었나 / 없는 게 맞나"를 구분할 수 없다.
UNMAPPED_PLATFORM_STATUSES: dict[str, str] = {
    "completed": (
        "동명이의. 플랫폼 담당자 검수 액션으로만 도달한다. 우리 축은 "
        "report_generated에서 끝나므로 사상하지 않는다 — 자동 매핑하면 "
        "사람의 검수가 조용히 사라진다(감사추적 구멍)."
    ),
    "refused": (
        "역방향 갭. 내담자 검사 거부를 우리는 표현할 수 없다. "
        "우리 쪽 상태 추가 여부는 회의 안건(README '다음에 할 일' 3번)."
    ),
    "cancelled": (
        "역방향 갭. 센터/검사자 취소를 우리는 표현할 수 없다. "
        "refused와 같은 안건."
    ),
}


# --- 이벤트 사상: 플랫폼 이벤트 → 우리 전이 ---

# 값이 None이면 "우리 축에 대응 전이가 없다"는 뜻이고, 이유를 EVENT_NOTES에 적는다.
# (from, to) 튜플이면 그 이벤트가 우리 쪽 어떤 전이에 해당하는지를 뜻한다.
EVENT_MAP: dict[str, tuple[str, str] | None] = {
    "created": ("__none__", "created"),
    "started": ("created", "in_progress"),
    "submitted": ("confirmed", "report_generated"),
    "completed": None,
    "refused": None,
    "cancelled": None,
    "reverted": None,
    "cancel_reverted": None,
    "updated": None,
    "deleted": None,
}

EVENT_NOTES: dict[str, str] = {
    "created": (
        "검사 생성. 우리 쪽 시작점이라 출발 상태가 없다(__none__)."
    ),
    "started": "내담자가 검사를 시작. 우리 created → in_progress와 대응.",
    "submitted": (
        "채점·보고서 완료 후 담당자 검수 대기로 넘어감. 우리 "
        "confirmed → report_generated와 대응하는 유일한 전이 트리거."
    ),
    "completed": (
        "플랫폼 담당자 검수 완료. 우리 축 밖의 사건이다 — 위 "
        "UNMAPPED_PLATFORM_STATUSES['completed'] 참조."
    ),
    "refused": "내담자 거부. 우리에게 대응 상태가 없다(역방향 갭).",
    "cancelled": "센터/검사자 취소. 우리에게 대응 상태가 없다(역방향 갭).",
    "reverted": (
        "완료 되돌리기. **정적 전이 맵으로 표현 불가능하다** — 목적지가 "
        "고정값이 아니라 process['previous_status']에 저장된 값이다"
        "(revert_task.py:28, 없으면 'submitted'). 우리 VALID_TRANSITIONS는 "
        "정적 맵이므로 구조적으로 대응물이 없다."
    ),
    "cancel_reverted": (
        "취소 되돌리기. reverted와 같은 이유로 표현 불가능하다 — 목적지가 "
        "process['previous_status']에서 나온다"
        "(revert_cancel_task.py:24, 없으면 'pending')."
    ),
    "updated": (
        "status를 바꾸지 않는다 — changed dict만 싣는 CRUD 이벤트. "
        "전이 사상의 정의역 밖."
    ),
    "deleted": "status를 바꾸지 않는다(soft delete). 전이 사상의 정의역 밖.",
}


# --- 준동형 검증 ---

def map_status(status: str) -> str | None:
    """f — 우리 상태를 플랫폼 상태로 사상. 정의역 밖이면 None."""
    return STATUS_MAP.get(status)


def check_homomorphism(valid_transitions: dict[str, list[str]]) -> list[str]:
    """f가 전이를 보존하는지 전수 확인. 위반 목록을 반환한다(빈 리스트면 성립).

    조건: 우리 쪽 전이 s → t 각각에 대해, f(s)와 f(t)가 플랫폼에서도
    이어져야 한다. 단 접힘(f(s) == f(t))은 위반이 아니다 — 여러 원소가
    한 원소로 가는 것은 사상이 허용하는 형태이고, 실제로 우리 4구간이
    플랫폼 in_progress 하나로 접힌다.

    검사하는 것은 **역전이가 접힘 안에 갇히는가**다. 접힘 밖으로 나가는
    역방향 화살표가 있으면 플랫폼에서 되돌아갈 수 없는 전이를 우리가
    허용하는 셈이라 어긋난다.
    """
    violations: list[str] = []

    # 플랫폼 전이 가능표 — 실측한 서비스 가드에서 유도.
    # (updated/deleted는 status를 안 바꾸므로 여기 없다)
    platform_next: dict[str, set[str]] = {
        "pending": {"in_progress", "refused", "cancelled"},
        "in_progress": {"submitted", "refused", "cancelled"},
        "submitted": {"completed", "cancelled"},
        "completed": {"cancelled"},  # revert는 previous_status라 정적 표현 불가
        "refused": set(),
        "cancelled": set(),
    }

    for src, destinations in valid_transitions.items():
        fs = map_status(src)
        if fs is None:
            violations.append(f"{src}: f의 정의역 밖인데 전이 맵에 있다")
            continue
        for dst in destinations:
            ft = map_status(dst)
            if ft is None:
                violations.append(f"{src} → {dst}: f({dst})가 정의되지 않았다")
                continue
            if fs == ft:
                continue  # 접힘 — 플랫폼에서는 같은 상태 안의 움직임
            if ft not in platform_next.get(fs, set()):
                violations.append(
                    f"{src} → {dst}: 사상하면 {fs} → {ft}인데 "
                    f"플랫폼에서 불가능한 전이다"
                )

    return violations


def build_mapping_contract() -> dict:
    """계약에 실을 사상표. export_state_contract.py가 호출한다."""
    return {
        "_comment": (
            "마인드봄 → 마인드스코프 사상표 초안. 회의 합의 전이므로 "
            "구현에 쓰지 말 것 — 지금은 '무엇이 대응하고 무엇이 대응하지 "
            "않는가'를 고정하는 용도다."
        ),
        "platform_statuses": list(PLATFORM_STATUSES),
        "platform_events": list(PLATFORM_EVENTS),
        "platform_terminal_statuses": sorted(PLATFORM_TERMINAL_STATUSES),
        "non_transition_events": sorted(NON_TRANSITION_EVENTS),
        "status_map": dict(STATUS_MAP),
        "unmapped_platform_statuses": dict(UNMAPPED_PLATFORM_STATUSES),
        "event_map": {
            event: (
                None
                if EVENT_MAP[event] is None
                else {"from": EVENT_MAP[event][0], "to": EVENT_MAP[event][1]}
            )
            for event in PLATFORM_EVENTS
        },
        "event_notes": {event: EVENT_NOTES[event] for event in PLATFORM_EVENTS},
    }
