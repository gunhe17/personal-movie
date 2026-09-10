"""ContextAssembler — "입력 데이터 → LLM 입력" 순수 조합기. 프롬프트 상수는 prompts.py.

SYSTEM은 요청 간 바이트 동일(캐시 프리픽스 불변식) — 동적 값은 전부 context_block으로.
프로필 스냅샷은 셸(application)이 조회해 주입한다 — runtime→application 역행 금지.
"""

from __future__ import annotations

import functools
import re
from datetime import date, timedelta
from typing import Any

from app.runtime.assistant.prompts import GUARDS, SYSTEM, PromptBundle, TurnInput

# 프로필 몫(앵커+패턴+기본값) 문자 예산 — 초과 시 narrative 줄부터 절단 (context rot 가드)
_PROFILE_CHAR_BUDGET = 600

# 참여자 bridge — query tool은 있으나 필터 감사(TOOL_MODEL) 대상이 아닌 엔티티
_BRIDGE_ENTITIES = {"counseling_case_participant", "assessment_case_participant"}

# 총체 쿼리 tool → 대상 모델 — FK 관계 블록(_fk_block)과 투영 커버리지 감사가 공유하는 표면 정의
TOOL_MODEL = {
    "query_client_handler": ("app.modules.client.profile.models", "Client"),
    "query_member_handler": ("app.modules.center.member.models", "Member"),
    "query_schedule_handler": ("app.modules.schedule.schedule.models", "Schedule"),
    "query_case_handler": (
        "app.modules.counseling.counseling_case.models",
        "CounselingCase",
    ),
    "query_counseling_session_handler": (
        "app.modules.counseling.counseling_session.models",
        "CounselingSession",
    ),
    "query_counseling_note_handler": (
        "app.modules.counseling.counseling_note.models",
        "CounselingNote",
    ),
    "query_assessment_handler": (
        "app.modules.assessment.assessment.models",
        "Assessment",
    ),
    "query_assessment_case_handler": (
        "app.modules.assessment.assessment_case.models",
        "AssessmentCase",
    ),
    "query_assessment_session_handler": (
        "app.modules.assessment.assessment_session.models",
        "AssessmentSession",
    ),
    "query_billable_handler": ("app.modules.billing.billable.models", "Billable"),
    "query_price_list_handler": ("app.modules.billing.price_list.models", "PriceList"),
    "query_document_handler": ("app.modules.document.document.models", "Document"),
    "query_form_template_handler": ("app.modules.form.template.models", "FormTemplate"),
    "query_form_instance_handler": ("app.modules.form.form.models", "Form"),
    "query_field_note_handler": (
        "app.modules.field_note.field_note.models",
        "FieldNote",
    ),
    "query_institution_handler": (
        "app.modules.institution.institution.models",
        "Institution",
    ),
    "query_room_handler": ("app.modules.center.room.models", "Room"),
    "query_program_handler": ("app.modules.center.program.models", "Program"),
    "query_member_invitation_handler": (
        "app.modules.center.member_invitation.models",
        "MemberInvitation",
    ),
    "query_notice_handler": ("app.modules.notice.notice.models", "Notice"),
    "query_notification_handler": (
        "app.modules.notification.notification.models",
        "Notification",
    ),
    "query_client_voucher_handler": (
        "app.modules.voucher.client_voucher.models",
        "ClientVoucher",
    ),
    "query_center_voucher_handler": (
        "app.modules.voucher.center_voucher.models",
        "CenterVoucher",
    ),
    "query_payment_handler": ("app.modules.billing.payment.models", "Payment"),
    "query_schedule_change_request_handler": (
        "app.modules.schedule.schedule_change_request.models",
        "ScheduleChangeRequest",
    ),
    "query_member_working_time_handler": (
        "app.modules.center.member_working_time.models",
        "MemberWorkingTime",
    ),
    "query_operating_time_handler": (
        "app.modules.center.center_operating_time.models",
        "OperatingTime",
    ),
    "query_subscription_handler": (
        "app.modules.subscription.subscription.models",
        "Subscription",
    ),
    "query_credit_balance_handler": (
        "app.modules.llm.credit_balance.models",
        "CreditBalance",
    ),
    "query_message_log_handler": (
        "app.modules.messaging.messaging.models",
        "MessageLog",
    ),
    "query_assessment_package_handler": (
        "app.modules.assessment.assessment_package.models",
        "AssessmentPackage",
    ),
    # query_activity 는 제외 — 감사로그는 event_atomics 재구성 표현, 단일 모델 매핑 없음
}


@functools.cache
def _fk_block() -> str:
    """assistant query 표면 엔티티의 참조 간선 — 모델 마커에서 라이브 추출, 프로세스당 1회.

    SYSTEM 뒤에 붙는 정적 캐시 프리픽스의 일부라 sorted로 바이트 결정성 보장.
    """
    from app.infrastructure.persistence.relations import extract

    entities = _BRIDGE_ENTITIES | {
        re.sub(r"(?<!^)(?=[A-Z])", "_", cls).lower() for _, cls in TOOL_MODEL.values()
    }
    lines = sorted(
        f"{r.src}.{r.col} -> {r.target}" for r in extract() if r.src in entities
    )
    return "\n## 테이블 참조 관계 (raw FK)\n" + "\n".join(lines) + "\n"


def assemble(
    *,
    permissions: tuple[str, ...],
    profile: Any | None,
    history: list[dict[str, Any]],
) -> TurnInput:
    """profile = 셸이 조회한 ProfileSnapshot(덕 타이핑) — 실패 시 None(날짜만으로 진행)."""
    return TurnInput(
        bundle=PromptBundle(
            system=SYSTEM + _fk_block(),
            context_block=_context_block(permissions=permissions, profile=profile),
            guards=GUARDS,
        ),
        history=history,
    )


def _context_block(
    *,
    permissions: tuple[str, ...],
    profile: Any | None,
) -> str:
    # 주간 달력은 서버가 계산해 주입 — 모델의 날짜·요일 산술(±1 flake)을 제거.
    # 요일별 날짜까지 펼친다("지난주 금요일" 실측 ±1 잔존 → 매핑 자체를 제공).
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    def week_days(
        label: str,
        offset: int,
    ) -> str:
        start = monday + timedelta(weeks=offset)
        days = " ".join(
            f"{'월화수목금토일'[i]}={(start + timedelta(days=i)).isoformat()}"
            for i in range(7)
        )
        return f"{label}: {days}"

    two_ago = monday - timedelta(weeks=2)
    lines = [
        f"오늘: {today.isoformat()}({'월화수목금토일'[today.weekday()]}요일)",
        week_days("지난주", -1),
        week_days("이번주", 0),
        week_days("다음주", 1),
        f"지지난주={two_ago.isoformat()}~{(two_ago + timedelta(days=6)).isoformat()}",
    ]

    # 권한 줄 제거 (permission-at-execution proven 2026-07-30, 거절 30%→0% — 옛 D12 뒤집음):
    # denied 목록 사전 고지가 권한 환각을 프라이밍. 권한은 Executor 실행-시 사실 피드백이 정본,
    # 정직성은 그 피드백만으로 보존됨(E2 10/10 실측).

    if profile is not None:
        if getattr(profile, "center_name", None):
            lines.append(f"센터: {profile.center_name}")
        if getattr(profile, "member_name", None):
            lines.append(f"사용자: {profile.member_name}")
        lines.extend(_profile_lines(profile))
    return "\n".join(lines)


def _profile_lines(snapshot: Any) -> list[str]:
    """앵커·업무 패턴·기본값 — 전 라인 조건부, 예산 초과 시 narrative부터 절단."""
    lines: list[str] = []
    if snapshot.recent_interactions:
        lines.append(f"최근 작업: {' · '.join(snapshot.recent_interactions)}")

    narrative = snapshot.narrative or {}
    if narrative.get("summary"):
        focus = ", ".join(narrative.get("focus") or [])
        suffix = f" (주: {focus})" if focus else ""
        lines.append(f"업무 패턴: {narrative['summary']}{suffix}")

    defaults = snapshot.defaults or {}
    parts: list[str] = []
    room = defaults.get("usual_room")
    if room and room.get("name"):
        parts.append(room["name"])
    if defaults.get("usual_duration_min"):
        parts.append(f"{defaults['usual_duration_min']}분")
    program = defaults.get("usual_program")
    if program and program.get("name"):
        parts.append(program["name"])
    if parts:
        lines.append(f"자주 쓰는 값: {' · '.join(parts)}")

    while lines and sum(len(x) for x in lines) > _PROFILE_CHAR_BUDGET:
        dropped = next((x for x in lines if x.startswith("업무 패턴")), lines[-1])
        lines.remove(dropped)
    return lines
