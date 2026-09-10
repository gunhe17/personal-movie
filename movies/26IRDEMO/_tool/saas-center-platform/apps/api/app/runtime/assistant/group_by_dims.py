"""agent query group_by 차원 표 — 필터 대칭 dim (agent-query.md G-impl).

handler가 group_by를 직접 처리(패턴 B)하면 execute가 재집계하지 않는다.
그 외 적격 query는 catalog가 enum 주입 + execute가 list→bucket(패턴 A).
"""

from __future__ import annotations

# tool name → 허용 dim (list 필터 키와 동일). 설정성·0~1행 도구 제외.
GROUP_BY_DIMS: dict[str, tuple[str, ...]] = {
    "query_activity_handler": (
        "category",
        "action",
        "entity_type",
        "entity_id",
        "actor_id",
    ),
    "query_assessment_handler": (
        "assessment_type",
        "workflow_type",
        "supports_online",
    ),
    "query_assessment_case_handler": (
        "status",
        "counselor_id",
        "client_id",
        "is_final_report_required",
    ),
    "query_assessment_package_handler": ("is_active",),
    "query_assessment_participant_handler": ("case_id", "participant_id", "role"),
    "query_assessment_session_handler": (
        "status",
        "case_id",
        "client_id",
        "schedule_id",
    ),
    "query_billable_handler": ("status", "client_id"),
    "query_case_handler": ("status", "program_id", "counselor_id", "client_id"),
    "query_center_voucher_handler": ("catalog_id", "is_active"),
    "query_client_handler": ("role", "status", "gender"),
    # center_voucher_id = handler 패턴 B. client_id = execute 패턴 A.
    "query_client_voucher_handler": ("client_id", "center_voucher_id"),
    "query_counseling_note_handler": (
        "client_id",
        "author_id",
        "counseling_session_id",
    ),
    "query_counseling_participant_handler": (
        "counseling_case_id",
        "participant_id",
        "role",
    ),
    "query_counseling_session_handler": (
        "status",
        "counseling_case_id",
        "client_id",
        "schedule_id",
    ),
    "query_document_handler": ("file_type", "access_level", "uploader_id"),
    "query_field_note_handler": (
        "status",
        "schedule_id",
        "author_id",
        "client_id",
        "task_id",
    ),
    "query_form_instance_handler": ("status", "template_id"),
    "query_form_template_handler": ("is_active", "status"),
    "query_member_handler": ("role_code", "status", "employment_type"),
    "query_member_invitation_handler": ("status", "employment_type", "role_code"),
    "query_member_working_time_handler": ("member_id", "weekday"),
    "query_message_log_handler": ("message_type", "status", "template_code"),
    "query_notice_handler": ("category", "is_pinned"),
    "query_notification_handler": (
        "category",
        "event_type",
        "priority",
        "is_read",
    ),
    "query_payment_handler": ("billable_id", "payment_method"),
    "query_price_list_handler": (
        "service_type",
        "is_active",
        "source",
        "reference_id",
    ),
    "query_program_handler": ("program_type", "is_active", "counselor_id"),
    "query_room_handler": ("is_active",),
    "query_schedule_handler": ("schedule_type", "room_id"),
    "query_schedule_change_request_handler": ("status", "schedule_id", "client_id"),
}

# E5 refined (group-by-surface-discrimination) — 전 적격 query 공통 주입.
# 「진행 포함 전체」vs「진행 중만」 대립을 명시. SQL GROUP BY와 무관(표면 문구만).
GROUP_BY_WHEN = (
    " 건수 모드 구분:"
    " (a) '전체·총 몇 개/건'만 또는 '진행 포함(해서) 전체/총' → group_by 금지, aggregate 한 숫자."
    " (b) '진행 중·진행 중인·진행 중만·특정 조건 한 집합' → group_by 금지, 해당 필터만."
    " (c) '~별·각각·별로' → group_by에 그 차원 1개 1회, rows[].count."
    " (a)(b)에서 축으로 나누지 말 것."
)

# status dim 보유 도구 — E5 case 발화 정합 보강
GROUP_BY_WHEN_STATUS = (
    " status 축: '진행 포함 전체'≠상태별(group 금지)."
    " '진행 중/만'→status 필터·group_by 금지."
    " '상태별'→group_by=status 1회."
)

_GB_PROP_BASE = {
    "type": "string",
    "title": "분할 요약 차원",
    "description": (
        "'~별·각각·별로'일 때만. "
        "'전체·총·진행 포함 전체'·한 집합 건수에는 넣지 말고 aggregate.count를 읽는다. "
        "값은 이 도구 필터 축과 동일."
    ),
}
