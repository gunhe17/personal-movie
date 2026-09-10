from app.application.events.dispatch import Route
from app.application.handlers.care_board.sync_care_board import (
    sync_care_board_handler,
)
from app.application.handlers.assistant.analyze_assistant_member_profile import (
    analyze_assistant_member_profile_handler,
)
from app.application.handlers.assistant.update_assistant_conversation_title import (
    update_assistant_conversation_title_handler,
)
from app.application.handlers.notification.email_center_application_approved import (
    email_center_application_approved_handler,
)
from app.application.handlers.notification.email_login_notification import (
    email_login_notification_handler,
)
from app.application.handlers.notification.email_member_invited import (
    email_member_invited_handler,
)
from app.application.handlers.notification.email_support_inquiry import (
    email_support_inquiry_handler,
)
from app.application.handlers.notification.notify_assessment_session_cancelled import (
    notify_assessment_session_cancelled_handler,
)
from app.application.handlers.notification.notify_assessment_case_created import (
    notify_assessment_case_created_handler,
)
from app.application.handlers.notification.notify_assessment_case_updated import (
    notify_assessment_case_updated_handler,
)
from app.application.handlers.notification.notify_assessment_case_cancelled import (
    notify_assessment_case_cancelled_handler,
)
from app.application.handlers.notification.notify_assessment_case_deleted import (
    notify_assessment_case_deleted_handler,
)
from app.application.handlers.notification.notify_assessment_case_restored import (
    notify_assessment_case_restored_handler,
)
from app.application.handlers.notification.notify_assessment_case_completed import (
    notify_assessment_case_completed_handler,
)
from app.application.handlers.notification.notify_assessment_task_submitted import (
    notify_assessment_task_submitted_handler,
)
from app.application.handlers.notification.notify_inquiry_answered import (
    notify_inquiry_answered_handler,
)
from app.application.handlers.notification.notify_note_share_published import (
    notify_note_share_published_handler,
)
from app.application.handlers.notification.notify_notice_published import (
    notify_notice_published_handler,
)
from app.application.handlers.notification.notify_notice_remind import (
    notify_notice_remind_handler,
)
from app.application.handlers.notification.notify_assessment_assigned import (
    notify_assessment_assigned_handler,
)
from app.application.handlers.notification.notify_assessment_unassigned import (
    notify_assessment_unassigned_handler,
)
from app.application.handlers.notification.notify_center_warned import (
    notify_center_warned_handler,
)
from app.application.handlers.notification.notify_assessment_session_no_show import (
    notify_assessment_session_no_show_handler,
)
from app.application.handlers.notification.notify_assessment_session_reverted import (
    notify_assessment_session_reverted_handler,
)
from app.application.handlers.notification.notify_assessment_task_refused import (
    notify_assessment_task_refused_handler,
)
from app.application.handlers.counseling.enqueue_case_analysis import (
    enqueue_case_analysis_handler,
)
from app.application.handlers.voucher.enqueue_voucher_extraction import (
    enqueue_voucher_extraction_handler,
)
from app.application.handlers.ai_lab.enqueue_lab_batch_compare import (
    enqueue_lab_batch_compare_handler,
)
from app.application.handlers.form.enqueue_form_extraction import (
    enqueue_form_extraction_handler,
)
from app.application.handlers.field_note.enqueue_pipeline_dispatch import (
    enqueue_pipeline_dispatch_handler,
)
from app.application.handlers.notification.notify_counseling_case_created import (
    notify_counseling_case_created_handler,
)
from app.application.handlers.notification.notify_counseling_case_updated import (
    notify_counseling_case_updated_handler,
)
from app.application.handlers.notification.notify_counseling_case_deleted import (
    notify_counseling_case_deleted_handler,
)
from app.application.handlers.notification.notify_counseling_session_cancelled import (
    notify_counseling_session_cancelled_handler,
)
from app.application.handlers.notification.notify_counseling_session_created import (
    notify_counseling_session_created_handler,
)
from app.application.handlers.notification.notify_counseling_session_deleted import (
    notify_counseling_session_deleted_handler,
)
from app.application.handlers.notification.notify_counseling_session_reverted import (
    notify_counseling_session_reverted_handler,
)
from app.application.handlers.notification.notify_counseling_session_status_changed import (
    notify_counseling_session_status_changed_handler,
)
from app.application.handlers.notification.sms_counseling_session_reminder import (
    sms_counseling_session_reminder_handler,
)
from app.application.handlers.notification.notify_schedule_updated import (
    notify_schedule_updated_handler,
)
from app.application.handlers.notification.notify_schedule_deleted import (
    notify_schedule_deleted_handler,
)
from app.application.handlers.notification.notify_schedule_change_request_approved import (
    notify_schedule_change_request_approved_handler,
)
from app.application.handlers.notification.notify_schedule_change_request_rejected import (
    notify_schedule_change_request_rejected_handler,
)
from app.application.handlers.notification.notify_app_schedule_cancelled import (
    notify_app_schedule_cancelled_handler,
)
from app.application.handlers.notification.notify_schedule_change_requested import (
    notify_schedule_change_requested_handler,
)
from app.application.handlers.notification.notify_app_invitation_issued import (
    notify_app_invitation_issued_handler,
)
from app.application.handlers.notification.sms_assessment_case_created import (
    sms_assessment_case_created_handler,
)
from app.application.handlers.notification.sms_assessment_session_reminder import (
    sms_assessment_session_reminder_handler,
)
from app.application.handlers.notification.sms_counseling_case_created import (
    sms_counseling_case_created_handler,
)
from app.application.handlers.notification.notify_assessment_send_result_created import (
    notify_assessment_send_result_created_handler,
)

# event_name → [Route]. 반응 없는 이벤트는 미등록(dispatch가 succeed).
EVENT_REACTIONS: dict[str, list[Route]] = {
    "assistant_turn_started": [
        Route(
            handler=update_assistant_conversation_title_handler,
            source="assistant_turn.started",
            project=lambda p: {
                "conversation_id": p["data"]["conversation_id"],
                "user_message": p["data"]["user_message"],
            },
        ),
        Route(
            handler=analyze_assistant_member_profile_handler,
            source="assistant_turn.started",
            project=lambda p: {"conversation_id": p["data"]["conversation_id"]},
        ),
    ],
    "experiment_group_created": [
        Route(
            handler=enqueue_lab_batch_compare_handler,
            source="experiment_group.created",
            project=lambda p: {
                "group_id": p["data"]["id"],
                "variants": p["data"]["variants"],
            },
        ),
    ],
    "form_extraction_created": [
        Route(
            handler=enqueue_form_extraction_handler,
            source="form_extraction.created",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    "form_extraction_retried": [
        Route(
            handler=enqueue_form_extraction_handler,
            source="form_extraction.retried",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    # 전진은 워커 executor(job_type=voucher_extract)가 소유한다 — 옛 query-trigger 전진은
    # 요청 수명이 곧 작업 수명이라 스테이지가 통째로 죽었다(2026-08-31 실측). 같은 row 를
    # 동시에 건드리는 충돌은 실행권 선점(claim_extraction_stage)이 막는다.
    "voucher_extraction_created": [
        Route(
            handler=enqueue_voucher_extraction_handler,
            source="voucher_extraction.created",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    "voucher_extraction_retried": [
        Route(
            handler=enqueue_voucher_extraction_handler,
            source="voucher_extraction.retried",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    "voucher_extraction_layout_confirmed": [
        Route(
            handler=enqueue_voucher_extraction_handler,
            source="voucher_extraction.layout_confirmed",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    "voucher_extraction_resumed": [
        Route(
            handler=enqueue_voucher_extraction_handler,
            source="voucher_extraction.resumed",
            project=lambda p: {"extraction_id": p["data"]["id"]},
        ),
    ],
    "field_note_pipeline_requested": [
        Route(
            handler=enqueue_pipeline_dispatch_handler,
            source="field_note.pipeline_requested",
            project=lambda p: {
                "field_note_id": p["field_note_id"],
                "job_type": p["job_type"],
                "params": p["params"],
            },
        ),
    ],
    "counseling_case_analysis_created": [
        Route(
            handler=enqueue_case_analysis_handler,
            source="case_analysis.created",
            project=lambda p: {
                "analysis_id": p["data"]["id"],
                "member_id": p["data"].get("member_id"),
                "session_take": p["data"].get("session_take"),
            },
        ),
    ],
    "counseling_note_share_published": [
        Route(
            handler=notify_note_share_published_handler,
            source="counseling_note_share.published",
            project=lambda p: {
                "share_id": p["result"]["id"],
                "session_id": p["result"]["counseling_session_id"],
                "client_id": p["result"]["client_id"],
                "status": p["result"]["status"],
                "published_at": p["result"]["published_at"],
            },
        ),
    ],
    "counseling_case_updated": [
        Route(
            handler=notify_counseling_case_updated_handler,
            source="counseling_case.updated",
            project=lambda p: {
                "case_id": p["result"]["id"],
                "case_code": p["result"]["case_code"],
                "counselor_id": p["result"]["counselor_id"],
                "changed": p["input"],
            },
        ),
        Route(
            handler=notify_counseling_session_cancelled_handler,
            source="counseling_session.cancelled",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
        Route(
            handler=notify_counseling_session_created_handler,
            source="counseling_session.created",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
        Route(
            handler=sms_counseling_session_reminder_handler,
            source="counseling_session.created",
            project=lambda p: {
                "case_id": p["data"]["counseling_case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
    ],
    "counseling_case_edits_applied": [
        Route(
            handler=notify_counseling_case_updated_handler,
            source="counseling_case.updated",
            project=lambda p: {
                "case_id": p["result"]["id"],
                "case_code": p["result"]["case_code"],
                "counselor_id": p["result"]["counselor_id"],
                "changed": p["input"],
            },
        ),
        Route(
            handler=notify_counseling_session_created_handler,
            source="counseling_session.created",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
        Route(
            handler=sms_counseling_session_reminder_handler,
            source="counseling_session.created",
            project=lambda p: {
                "case_id": p["data"]["counseling_case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
        Route(
            handler=notify_counseling_session_deleted_handler,
            source="counseling_session.deleted",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "counseling_case_deleted": [
        Route(
            handler=notify_counseling_case_deleted_handler,
            source="counseling_case.deleted",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
            },
        ),
    ],
    "counseling_session_cancelled": [
        Route(
            handler=notify_counseling_session_cancelled_handler,
            source="counseling_session.cancelled",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "counseling_session_created": [
        Route(
            handler=notify_counseling_session_created_handler,
            source="counseling_session.created",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "counseling_session_updated": [
        Route(
            handler=notify_counseling_session_status_changed_handler,
            source="counseling_session.updated",
            project=lambda p: {
                "session_id": p["result"]["id"],
                "case_id": p["result"]["counseling_case_id"],
                "status": p["input"].get("status"),
            },
        ),
    ],
    "counseling_session_reverted": [
        Route(
            handler=notify_counseling_session_reverted_handler,
            source="counseling_session.reverted",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "counseling_session_deleted": [
        Route(
            handler=notify_counseling_session_deleted_handler,
            source="counseling_session.deleted",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "counseling_case_intaken": [
        Route(
            handler=notify_counseling_case_created_handler,
            source="counseling_session.created",
            project=lambda p: {"case_id": p["data"]["counseling_case_id"]},
        ),
        Route(
            handler=sms_counseling_session_reminder_handler,
            source="counseling_session.created",
            project=lambda p: {
                "case_id": p["data"]["counseling_case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
        Route(
            handler=sms_counseling_case_created_handler,
            source="counseling_case.created",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
            },
        ),
    ],
    "counseling_sessions_added": [
        Route(
            handler=notify_counseling_session_created_handler,
            source="counseling_session.created",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
        Route(
            handler=sms_counseling_session_reminder_handler,
            source="counseling_session.created",
            project=lambda p: {
                "case_id": p["data"]["counseling_case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
    ],
    # legacy pending event 호환 — 운영 DB 소진 확인 뒤 별도 제거.
    "schedule_created": [
        Route(
            handler=notify_counseling_case_created_handler,
            source="counseling_session.created",
            project=lambda p: {"case_id": p["data"]["counseling_case_id"]},
        ),
        Route(
            handler=sms_counseling_session_reminder_handler,
            source="counseling_session.created",
            project=lambda p: {
                "case_id": p["data"]["counseling_case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
    ],
    "schedule_updated": [
        Route(
            handler=notify_schedule_updated_handler,
            source="schedule.updated",
            project=lambda p: {
                "schedule_id": p["result"]["id"],
                "changed": p["input"],
                "start": p["result"]["start"],
            },
        ),
    ],
    "schedule_deleted": [
        Route(
            handler=notify_schedule_deleted_handler,
            source="schedule.deleted",
            project=lambda p: {"schedule_id": p["data"]["id"]},
        ),
    ],
    "schedule_change_request_approved": [
        Route(
            handler=notify_schedule_updated_handler,
            source="schedule.updated",
            project=lambda p: {
                "schedule_id": p["result"]["id"],
                "changed": p["input"],
                "start": p["result"]["start"],
            },
        ),
        Route(
            handler=notify_schedule_change_request_approved_handler,
            source="schedule_change_request.approved",
            project=lambda p: {
                "request_id": p["data"]["id"],
                "schedule_id": p["data"]["schedule_id"],
                "decided_by_member_id": p["data"]["decided_by_member_id"],
            },
        ),
    ],
    "schedule_change_request_rejected": [
        Route(
            handler=notify_schedule_change_request_rejected_handler,
            source="schedule_change_request.rejected",
            project=lambda p: {
                "request_id": p["data"]["id"],
                "schedule_id": p["data"]["schedule_id"],
                "client_id": p["data"]["client_id"],
                "decision_note": p["data"]["decision_note"],
                "decided_by_member_id": p["data"]["decided_by_member_id"],
            },
        ),
    ],
    "schedule_change_requested": [
        Route(
            handler=notify_schedule_change_requested_handler,
            source="schedule_change_request.created",
            project=lambda p: {
                "request_id": p["data"]["id"],
                "schedule_id": p["data"]["schedule_id"],
                "current_start": p["data"]["current_start"],
                "requested_start": p["data"]["requested_start"],
            },
        ),
    ],
    "app_schedule_cancelled": [
        Route(
            handler=notify_app_schedule_cancelled_handler,
            source="counseling_session.cancelled",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["counseling_case_id"],
            },
        ),
    ],
    "app_invitation_issued": [
        Route(
            handler=notify_app_invitation_issued_handler,
            source="center_link_invitation.issued",
            project=lambda p: {
                "invitation_id": p["data"]["id"],
                "guardian_client_id": p["data"]["guardian_client_id"],
            },
        ),
    ],
    "assessment_case_created": [
        Route(
            handler=notify_assessment_case_created_handler,
            source="assessment_case.created",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
            },
        ),
        Route(
            handler=sms_assessment_case_created_handler,
            source="assessment_case.created",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
            },
        ),
        Route(
            handler=sms_assessment_session_reminder_handler,
            source="assessment_session.created",
            project=lambda p: {
                "case_id": p["data"]["case_id"],
                "schedule_id": p["data"]["schedule_id"],
            },
        ),
    ],
    "assessment_send_result_created": [
        Route(
            handler=notify_assessment_send_result_created_handler,
            source="assessment_send_result.created",
            project=lambda p: {"case_id": p["data"]["case_id"]},
        ),
    ],
    "assessment_case_updated": [
        Route(
            handler=notify_assessment_case_updated_handler,
            source="assessment_case.updated",
            project=lambda p: {
                "case_id": p["result"]["id"],
                "case_code": p["result"]["case_code"],
                "counselor_id": p["result"]["counselor_id"],
            },
        ),
    ],
    "assessment_case_cancelled": [
        Route(
            handler=notify_assessment_case_cancelled_handler,
            source="assessment_case.cancelled",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
                "cancelled_at": p["data"].get("updated_at"),
            },
        ),
    ],
    "assessment_case_deleted": [
        Route(
            handler=notify_assessment_case_deleted_handler,
            source="assessment_case.deleted",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
            },
        ),
    ],
    "assessment_case_cancel_reverted": [
        Route(
            handler=notify_assessment_case_restored_handler,
            source="assessment_case.cancel_reverted",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
            },
        ),
    ],
    "assessment_case_completed": [
        Route(
            handler=notify_assessment_case_completed_handler,
            source="assessment_case.completed",
            project=lambda p: {
                "case_id": p["data"]["id"],
                "case_code": p["data"]["case_code"],
                "counselor_id": p["data"]["counselor_id"],
            },
        ),
    ],
    "assessment_task_submitted": [
        Route(
            handler=notify_assessment_task_submitted_handler,
            source="assessment_task.submitted",
            project=lambda p: {
                "case_id": p["data"]["case_id"],
                "task_id": p["data"]["id"],
            },
        ),
    ],
    "inquiry_answered": [
        Route(
            handler=notify_inquiry_answered_handler,
            source="inquiry.answered",
            project=lambda p: {"inquiry_id": p["data"]["id"]},
        ),
    ],
    "assessment_session_cancelled": [
        Route(
            handler=notify_assessment_session_cancelled_handler,
            source="assessment_session.cancelled",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["case_id"],
            },
        ),
    ],
    "assessment_task_refused": [
        Route(
            handler=notify_assessment_task_refused_handler,
            source="assessment_task.refused",
            project=lambda p: {
                "case_id": p["data"]["case_id"],
                "task_id": p["data"]["id"],
                "reason": (p["data"].get("process") or {}).get("refused_reason"),
            },
        ),
    ],
    # source가 notice.published라 초안→게시 전환(published atomic 존재) 시에만 fan-out.
    "notice_updated": [
        Route(
            handler=notify_notice_published_handler,
            source="notice.published",
            project=lambda p: {
                "notice_id": p["data"]["id"],
                "notice_title": p["data"]["title"],
            },
        ),
    ],
    "notice_reminded": [
        Route(
            handler=notify_notice_remind_handler,
            source="notice.reminded",
            project=lambda p: {"notice_id": p["data"]["id"]},
        ),
    ],
    "center_assessment_assigned": [
        Route(
            handler=notify_assessment_assigned_handler,
            source="center_assessment.assigned",
            project=lambda p: {
                "assessment_id": p["data"]["assessment_id"],
                "assessment_name": p["data"]["assessment_name"],
            },
        ),
    ],
    "center_warned": [
        Route(
            handler=notify_center_warned_handler,
            source="center.warned",
            project=lambda p: {
                "reason": p["data"]["reason"],
                "notify": p["data"]["notify"],
            },
        ),
    ],
    "center_assessment_unassigned": [
        Route(
            handler=notify_assessment_unassigned_handler,
            source="center_assessment.unassigned",
            project=lambda p: {
                "assessment_id": p["data"]["assessment_id"],
                "assessment_name": p["data"]["assessment_name"],
            },
        ),
    ],
    "assessment_session_no_show": [
        Route(
            handler=notify_assessment_session_no_show_handler,
            source="assessment_session.no_show",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["case_id"],
            },
        ),
    ],
    "assessment_session_reverted": [
        Route(
            handler=notify_assessment_session_reverted_handler,
            source="assessment_session.reverted",
            project=lambda p: {
                "session_id": p["data"]["id"],
                "case_id": p["data"]["case_id"],
                "reverted_at": p["data"]["updated_at"],
            },
        ),
    ],
    "account_logged_in": [
        Route(
            handler=email_login_notification_handler,
            source="login_notification.created",
            project=lambda p: {"notification_id": p["data"]["id"]},
        ),
    ],
    # legacy pending event 호환 — 운영 DB 소진 확인 뒤 별도 제거.
    "login_new_device_detected": [
        Route(
            handler=email_login_notification_handler,
            source="login_notification.created",
            project=lambda p: {"notification_id": p["data"]["id"]},
        ),
    ],
    "member_invitation_created": [
        Route(
            handler=email_member_invited_handler,
            source="member_invitation.created",
            project=lambda p: {
                "invitation_id": p["data"]["id"],
                "invitee_name": p["data"]["name"],
                "invitee_email": p["data"]["email"],
                "invited_by": p["data"]["invited_by"],
                "role_id": p["data"]["role_id"],
                "employment_type": p["data"]["employment_type"],
                "expires_at": p["data"]["expires_at"],
            },
        ),
    ],
    "inquiry_created": [
        Route(
            handler=email_support_inquiry_handler,
            source="inquiry.created",
            project=lambda p: {"inquiry_id": p["data"]["id"]},
        ),
    ],
    "center_application_approved": [
        Route(
            handler=email_center_application_approved_handler,
            source="center_application.approved",
            project=lambda p: {"application_id": p["data"]["id"]},
        ),
    ],
}


# ── 케어보드 시간축 갱신 (docs/careboard/domain.md §6-1) ──
# 앵커만 project하고, 내담자 환원·스냅샷 조립은 sync/rebuild가 소유한다.
# 위 리터럴에 이미 반응이 걸린 이벤트(assessment_case_created 등)에 덧붙여야 하므로
# 리터럴 안이 아니라 여기서 merge한다 — 같은 키를 리터럴에 두면 한쪽이 조용히 덮인다.
_CARE_BOARD_ANCHORS: tuple[tuple[str, str, object], ...] = (
    ("counseling_case_created", "counseling_case.created", lambda p: {"counseling_case_id": p["data"]["id"]}),
    ("counseling_case_updated", "counseling_case.updated", lambda p: {"counseling_case_id": p["result"]["id"]}),
    ("counseling_case_deleted", "counseling_case.deleted", lambda p: {"counseling_case_id": p["data"]["id"]}),
    ("counseling_session_created", "counseling_session.created", lambda p: {"counseling_case_id": p["data"]["counseling_case_id"]}),
    ("counseling_session_updated", "counseling_session.updated", lambda p: {"counseling_case_id": p["result"]["counseling_case_id"]}),
    ("counseling_session_cancelled", "counseling_session.cancelled", lambda p: {"counseling_case_id": p["data"]["counseling_case_id"]}),
    ("counseling_session_deleted", "counseling_session.deleted", lambda p: {"counseling_case_id": p["data"]["counseling_case_id"]}),
    ("counseling_sessions_added", "counseling_session.created", lambda p: {"counseling_case_id": p["data"]["counseling_case_id"]}),
    ("counseling_note_created", "counseling_note.created", lambda p: {"client_id": p["data"]["client_id"]}),
    ("counseling_note_updated", "counseling_note.updated", lambda p: {"client_id": p["result"]["client_id"]}),
    ("counseling_note_deleted", "counseling_note.deleted", lambda p: {"client_id": p["data"]["client_id"]}),
    ("assessment_case_created", "assessment_case.created", lambda p: {"assessment_case_id": p["data"]["id"]}),
    ("assessment_task_completed", "assessment_task.completed", lambda p: {"assessment_case_id": p["result"]["case_id"]}),
    ("assessment_task_updated", "assessment_task.updated", lambda p: {"assessment_case_id": p["result"]["case_id"]}),
    ("assessment_task_cancelled", "assessment_task.cancelled", lambda p: {"assessment_case_id": p["result"]["case_id"]}),
    ("client_resource_linked", "client_resource.created", lambda p: {"client_id": p["data"]["client_id"]}),
    ("billable_created", "billable.created", lambda p: {"client_id": p["data"]["client_id"]}),
    ("field_note_updated", "field_note.updated", lambda p: {"schedule_id": p["result"].get("schedule_id")}),
)

for _event_name, _source, _project in _CARE_BOARD_ANCHORS:
    EVENT_REACTIONS.setdefault(_event_name, []).append(
        Route(
            handler=sync_care_board_handler,
            source=_source,
            project=_project,
            name=f"sync_care_board:{_event_name}",
        )
    )
