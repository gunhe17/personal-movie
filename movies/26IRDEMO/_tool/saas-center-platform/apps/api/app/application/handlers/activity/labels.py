# #
# maps

ENTITY_TO_CATEGORY = {
    "account": "account",
    "admin_account": "admin",
    "admin_account_invitation": "admin",
    "agent_conversation": "agent",
    "llm_call": "agent",
    "assessment": "assessment",
    "assessment_session": "assessment",
    "assessment_session_participant": "assessment",
    "assessment_set": "assessment",
    "assessment_task": "assessment",
    "center_assessment": "assessment",
    "billable": "billing",
    "payment": "billing",
    "payment_record": "billing",
    "price_list": "billing",
    "center": "center",
    "member_non_working_time": "center",
    "non_operating_time": "center",
    "room": "center",
    "client": "client",
    "client_link_request": "client",
    "guardian_relation": "client",
    "relation": "client",
    "sibling_relation": "client",
    "case_analysis": "counseling",
    "counseling_note": "counseling",
    "counseling_session": "counseling",
    "session_participant": "counseling",
    "document": "document",
    "share_token": "document",
    "field_note": "field_note",
    "form": "form",
    "form_template": "form",
    "form_template_version": "form",
    "signature": "form",
    "member": "member",
    "member_invitation": "member",
    "person_credential": "member",
    "cs_memo": "support",
    "faq": "support",
    "inquiry": "support",
    "notice": "notice",
    "form_extraction": "form",
    "message_template": "messaging",
    "plan_config": "platform",
    "platform_settings": "platform",
    "program": "program",
    "role": "role",
    "schedule": "schedule",
    "subscription": "subscription",
    "subscription_payment": "subscription",
    "center_voucher": "voucher",
    "client_voucher": "voucher",
    "voucher": "voucher",
    "voucher_document": "voucher",
    "voucher_extraction": "voucher",
}

ENTITY_KO = {
    "account": "계정",
    "admin_account": "어드민 계정",
    "admin_account_invitation": "어드민 계정 초대",
    "plan_config": "플랜 설정",
    "platform_settings": "플랫폼 설정",
    "client": "내담자",
    "guardian_relation": "보호자 관계",
    "sibling_relation": "형제자매 관계",
    "relation": "관계",
    "client_link_request": "내담자 연동 요청",
    "schedule": "일정",
    "assessment": "검사도구",
    "assessment_set": "검사 세트",
    "assessment_session": "검사 세션",
    "assessment_session_participant": "검사 세션 참여자",
    "assessment_task": "검사 과제",
    "center_assessment": "센터 검사",
    "counseling_session": "상담 세션",
    "counseling_note": "상담 일지",
    "case_analysis": "사례 분석",
    "session_participant": "세션 참여자",
    "member": "구성원",
    "member_invitation": "구성원 초대",
    "person_credential": "자격 인증",
    "center": "센터",
    "room": "상담실",
    "non_operating_time": "비운영 시간",
    "member_non_working_time": "비근무 시간",
    "program": "프로그램",
    "price_list": "단가",
    "billable": "청구 항목",
    "payment": "결제",
    "payment_record": "결제 기록",
    "role": "권한",
    "document": "문서",
    "share_token": "공유 토큰",
    "field_note": "현장노트",
    "agent_conversation": "AI 대화",
    "llm_call": "AI 사용",
    "message_template": "문자 양식",
    "form_template": "양식 템플릿",
    "form_template_version": "양식 버전",
    "form": "양식",
    "form_extraction": "서식 추출",
    "notice": "공지사항",
    "inquiry": "문의",
    "faq": "FAQ",
    "cs_memo": "CS 메모",
    "signature": "서명",
    "center_voucher": "센터 바우처",
    "client_voucher": "내담자 바우처",
    "voucher": "바우처",
    "voucher_document": "바우처 자료",
    "voucher_extraction": "바우처 추출",
    "subscription": "구독",
    "subscription_payment": "구독 결제",
}

ACTION_KO = {
    "created": "생성",
    "updated": "수정",
    "deleted": "삭제",
    "cancelled": "취소",
    "restored": "복원",
    "approved": "승인",
    "rejected": "반려",
    "answered": "답변",
    "bulk_deleted": "일괄 삭제",
    "reminded": "리마인드 발송",
    "deactivated": "비활성화",
    "archived": "보관",
    "notify_remind": "리마인드 발송",  # legacy 행 표시용(정명 전 act)
    "retried": "재시도",
    "confirmed": "확정",
    "locked": "잠금",
    "unlocked": "잠금 해제",
    "force_logged_out": "강제 로그아웃",
    "force_logout": "강제 로그아웃",  # legacy 행 표시용(정명 전 act)
    "invited": "초대",
    "activated": "활성화",
    "suspended": "정지",
    "terminated": "해지",
    "warned": "경고",
    "assigned": "할당",
    "unassigned": "할당 해제",
    "toggled": "상태 전환",
    "used": "사용",
}

# bespoke 핸들러(subscription·ai_lab 등)는 마이그레이션 시 (entity_name, act) → 문구로 채운다.
SUMMARY_OVERRIDE: dict[tuple[str, str], str] = {
    ("subscription", "upgraded"): "구독 플랜 업그레이드",
    ("subscription", "plan_changed"): "구독 플랜 변경",
    ("subscription", "trial_granted"): "체험 부여",
    ("subscription", "status_transitioned"): "구독 상태 전이",
    ("subscription", "credit_adjusted"): "크레딧 수동 조정",
    ("subscription", "downgrade_reserved"): "다운그레이드 예약",
    (
        "subscription",
        "downgrade_scheduled",
    ): "다운그레이드 예약",  # legacy 행 표시용(수렴 전 이벤트)
    ("subscription", "downgrade_cancelled"): "다운그레이드 예약 취소",
    ("subscription", "downgrade_force_applied"): "다운그레이드 즉시 적용",
    ("subscription", "plan_change_approved"): "플랜 변경 요청 승인",
    ("subscription", "plan_change_rejected"): "플랜 변경 요청 거절",
    ("subscription_payment", "cancelled"): "결제 취소/환불",
}

CATEGORY_TO_ENTITIES: dict[str, list[str]] = {}
for _entity, _category in ENTITY_TO_CATEGORY.items():
    CATEGORY_TO_ENTITIES.setdefault(_category, []).append(_entity)


# #
# derive


def category_of(entity_name: str) -> str:
    return ENTITY_TO_CATEGORY.get(entity_name, entity_name)


def summary_of(entity_name: str, act: str) -> str:
    override = SUMMARY_OVERRIDE.get((entity_name, act))
    if override is not None:
        return override
    return f"{ENTITY_KO.get(entity_name, entity_name)} {ACTION_KO.get(act, act)}"


def entity_names_for(category: str | None, entity_type: str | None) -> list[str] | None:
    if entity_type is not None:
        return [entity_type]
    if category is not None:
        return CATEGORY_TO_ENTITIES.get(category, [category])
    return None
