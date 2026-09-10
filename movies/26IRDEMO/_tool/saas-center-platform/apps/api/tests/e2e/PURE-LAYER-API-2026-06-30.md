# PURE 레이어 API 목록 (Facade · Application 제외) — 2026-06-30

흐름이 **Router → (module) Handler → Service → Repository → DB**로 끝나는 엔드포인트만.
제외 기준: 라우터가 `app.application.handlers`를 호출(application 레이어)하거나, 핸들러가 `*Facade`를 사용(facade 레이어)하면 제외.

분류 방법: 모듈별 정적 분석(라우터 import 출처 + 핸들러 facade 사용 + `emit(` 호출 여부). 경로는 `app/main.py` 마운트(`/api/v1`, platform_admin은 `/api/v1/admin`) + aggregator prefix + route 합성.

## 핵심 — 지금 테스트 가능 여부

`Emits=Y`(이벤트 발행) PURE 엔드포인트는 **계열 A 회귀로 현재 깨져 있다**(라우터에 `start_event_group()` 미배선 → `event_group_id=None` → emit 500). `Emits=N`은 발행하지 않으므로 **지금 바로 e2e 가능**(read 전부 + 발행 안 하는 write).

- PURE 총 **124개**. 그중 **Emits=Y = 11개(현재 깨짐)**, **Emits=N = 113개(지금 테스트 가능)**.
- Emits=Y(우선 테스트 대상에서 제외, 계열 A 수정 후 가능): create_relation, delete_relation, create_link_request, create_center_assessment, update_center_assessment, assessment create_session, assessment update_session, update_speaker_map, delete_field_note, counseling create_case_analysis, document create_share_token.

---

## client / person / institution (27)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| POST | /api/v1/centers/{center_id}/clients/{client_id}/favorite | add_favorite_handler | N |
| DELETE | /api/v1/centers/{center_id}/clients/{client_id}/favorite | remove_favorite_handler | N |
| POST | /api/v1/centers/{center_id}/clients/{client_id}/relations | create_relation_handler | Y |
| GET | /api/v1/centers/{center_id}/clients/{client_id}/relations | get_relations_handler | N |
| DELETE | /api/v1/centers/{center_id}/clients/relations/{relation_id} | delete_relation_handler | Y |
| GET | /api/v1/centers/{center_id}/clients/link-requests/ | list_link_requests_handler | N |
| POST | /api/v1/centers/{center_id}/clients/link-requests | create_link_request_handler | Y |
| POST | /api/v1/centers/{center_id}/clients/link-requests/{request_id}/approve | approve_link_request_handler | N |
| POST | /api/v1/centers/{center_id}/clients/link-requests/{request_id}/reject | reject_link_request_handler | N |
| POST | /api/v1/persons | create_person_handler | N |
| GET | /api/v1/persons | list_persons_handler | N |
| GET | /api/v1/persons/{person_id} | get_person_handler | N |
| PUT | /api/v1/persons/{person_id} | update_person_handler | N |
| DELETE | /api/v1/persons/{person_id} | delete_person_handler | N |
| GET | /api/v1/persons/me/credentials | list_credentials_handler | N |
| POST | /api/v1/persons/me/credentials | create_credential_handler | N |
| PATCH | /api/v1/persons/me/credentials/{credential_id} | update_credential_handler | N |
| DELETE | /api/v1/persons/me/credentials/{credential_id} | delete_credential_handler | N |
| POST | /api/v1/persons/me/credentials/{credential_id}/request-verification | request_verification_handler | N |
| POST | /api/v1/persons/me/credentials/{credential_id}/attachment | upload_attachment_handler | N |
| DELETE | /api/v1/persons/me/credentials/{credential_id}/attachment | delete_attachment_handler | N |
| GET | /api/v1/persons/me/credentials/{credential_id}/attachment/download | download_attachment_handler | N |
| GET | /api/v1/institutions/ | list_institutions_handler | N |
| POST | /api/v1/institutions/ | create_institution_handler | N |
| GET | /api/v1/institutions/{institution_id} | get_institution_handler | N |
| PATCH | /api/v1/institutions/{institution_id} | update_institution_handler | N |
| DELETE | /api/v1/institutions/{institution_id} | delete_institution_handler | N |

Excluded: 10 application, 13 facade (of 50)

## assessment / schedule (15)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/assessments | list_assessments_handler | N |
| GET | /api/v1/assessments/{assessment_id} | get_assessment_handler | N |
| GET | /api/v1/centers/{center_id}/assessment-cases/{case_id}/send-links | list_send_links_handler | N |
| GET | /api/v1/centers/{center_id}/assessment-cases/{case_id}/send-results | list_send_results_handler | N |
| POST | /api/v1/centers/{center_id}/center-assessments/{assessment_id} | create_center_assessment_handler | Y |
| PATCH | /api/v1/centers/{center_id}/center-assessments/{assessment_id} | update_center_assessment_handler | Y |
| GET | /api/v1/centers/{center_id}/assessment-cases/{case_id}/participants | list_participants_handler | N |
| POST | /api/v1/centers/{center_id}/assessment-cases/{case_id}/participants | add_participant_handler | N |
| DELETE | /api/v1/centers/{center_id}/assessment-cases/{case_id}/participants/{participant_type}/{participant_id} | remove_participant_handler | N |
| POST | /api/v1/centers/{center_id}/assessment-cases/{case_id}/complete | complete_assessment_case_handler | N |
| GET | /api/v1/centers/{center_id}/assessment-cases/{case_id}/assessment-sessions | list_sessions_handler | N |
| GET | /api/v1/centers/{center_id}/assessment-sessions/{session_id} | get_session_handler | N |
| POST | /api/v1/centers/{center_id}/assessment-cases/{case_id}/assessment-sessions | create_session_handler | Y |
| PATCH | /api/v1/centers/{center_id}/assessment-sessions/{session_id} | update_session_handler | Y |
| POST | /api/v1/centers/{center_id}/assessment-sessions/{session_id}/attend | attend_session_handler | N |

Excluded: 28 application, 17 facade (of 60). schedule 모듈은 PURE 0 (전부 application/facade).

## counseling / document (12)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/centers/{center_id}/counseling/cases/{case_id}/analysis/preview | preview_case_analysis_handler | N |
| POST | /api/v1/centers/{center_id}/counseling/cases/{case_id}/analysis/ | create_case_analysis_handler | Y |
| GET | /api/v1/centers/{center_id}/counseling/cases/{case_id}/analysis/latest | get_latest_case_analysis_handler | N |
| GET | /api/v1/centers/{center_id}/counseling/cases/{case_id}/analysis/ | list_case_analyses_handler | N |
| DELETE | /api/v1/centers/{center_id}/counseling/session-participants/{session_participant_id} | remove_participant_handler | N |
| GET | /api/v1/centers/{center_id}/documents/ | list_documents_handler | N |
| GET | /api/v1/centers/{center_id}/documents/{document_id} | get_document_handler | N |
| GET | /api/v1/centers/{center_id}/document-accesses/documents/{document_id} | list_document_accesses_handler | N |
| GET | /api/v1/centers/{center_id}/document-accesses/accounts/{account_id} | list_account_accesses_handler | N |
| POST | /api/v1/document/share/share/ | create_share_token_handler | Y |
| POST | /api/v1/document/share/share/validate | validate_share_token_handler | N |
| GET | /api/v1/document/share/share/documents/{document_id} | list_share_tokens_handler | N |

Excluded: 14 application, 25 facade (of 51)

## field_note / form (12)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/centers/{center_id}/field-notes/config | (inline) | N |
| GET | /api/v1/centers/{center_id}/field-notes/unlinked | list_unlinked_handler | N |
| GET | /api/v1/centers/{center_id}/field-notes/statuses | get_field_note_statuses_handler | N |
| GET | /api/v1/centers/{center_id}/field-notes/by-schedule/{schedule_id} | get_field_note_by_schedule_handler | N |
| POST | /api/v1/centers/{center_id}/field-notes/{field_note_id}/entries | add_entry_handler | N |
| POST | /api/v1/centers/{center_id}/field-notes/{field_note_id}/audio | upload_audio_chunk_handler | N |
| GET | /api/v1/centers/{center_id}/field-notes/{field_note_id}/audio/{audio_id}/download-url | get_audio_download_url_handler | N |
| PATCH | /api/v1/centers/{center_id}/field-notes/{field_note_id}/finish | finish_recording_handler | N |
| PATCH | /api/v1/centers/{center_id}/field-notes/{field_note_id}/link-schedule | link_schedule_handler | N |
| GET | /api/v1/centers/{center_id}/field-notes/by-task/{task_id} | get_field_notes_by_task_handler | N |
| PATCH | /api/v1/centers/{center_id}/field-notes/{field_note_id}/speaker-map | update_speaker_map_handler | Y |
| DELETE | /api/v1/centers/{center_id}/field-notes/{field_note_id} | delete_field_note_handler | Y |

Excluded: 10 application, 27 facade (of 49). form 모듈은 PURE 0.

## center / role / auth (9)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/auth/check-email | check_email_handler | N |
| GET | /api/v1/auth/devices | list_devices_handler | N |
| POST | /api/v1/auth/devices/revoke | revoke_device_handler | N |
| GET | /api/v1/centers/{center_id}/note-preferences | get_note_preference_handler | N |
| PATCH | /api/v1/centers/{center_id}/note-preferences | upsert_note_preference_handler | N |
| POST | /api/v1/role/permissions/ | create_permission_handler | N |
| GET | /api/v1/role/permissions/ | list_permissions_handler | N |
| GET | /api/v1/role/roles/ | list_roles_handler | N |
| GET | /api/v1/role/roles/{role_id} | get_role_handler | N |

Excluded: 27 application, 42 facade, 1 inline-echo(get_my_permissions) (of 79)

## ai_lab / llm / agent (3)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/centers/{center_id}/credit/rate-config | get_credit_rate_config_handler | N |
| GET | /api/v1/admin/ai-lab/feature-test/{center_id}/cases/{case_id}/analysis/preview | preview_case_analysis_handler | N |
| GET | /api/v1/admin/ai-lab/feature-test/{center_id}/cases/{case_id}/analysis/latest | get_latest_case_analysis_handler | N |

Excluded: 12 application, 48 facade (of 63)

## voucher / billing / subscription (2)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/centers/{center_id}/subscription/plans | get_plans_handler | N |
| GET | /api/v1/centers/{center_id}/subscription/toss-client-key | (inline) | N |

Excluded: 32 application, 42 facade (of 76). voucher·billing 모듈은 PURE 0.

## platform_admin (44)

마운트 `/api/v1/admin`. (group3 자동분류 18 + 수동분류 26)

| Method | Path | Handler | Emits |
|--------|------|---------|-------|
| GET | /api/v1/admin/ai-usage/summary | get_summary_handler | N |
| GET | /api/v1/admin/ai-usage/monthly | get_monthly_handler | N |
| GET | /api/v1/admin/ai-usage/by-model | get_by_model_handler | N |
| GET | /api/v1/admin/ai-usage/by-feature | get_by_feature_handler | N |
| GET | /api/v1/admin/ai-usage/by-center | get_by_center_handler | N |
| GET | /api/v1/admin/ai-usage/rate-config | get_credit_rate_config_handler | N |
| PUT | /api/v1/admin/ai-usage/rate-config | change_credit_rate_handler | N |
| GET | /api/v1/admin/ai-usage/calls | get_calls_handler | N |
| POST | /api/v1/admin/pipeline/reload | (inline) | N |
| POST | /api/v1/admin/pipeline/reload-vectors | (inline) | N |
| GET | /api/v1/admin/vouchers | list_vouchers_handler | N |
| GET | /api/v1/admin/form-extractions | list_form_extractions_handler | N |
| GET | /api/v1/admin/credentials/ | list_pending_credentials_handler | N |
| GET | /api/v1/admin/credentials/by-account/{account_id} | list_account_credentials_handler | N |
| GET | /api/v1/admin/platform-settings | get_platform_settings_handler | N |
| PATCH | /api/v1/admin/platform-settings | update_platform_settings_handler | N |
| GET | /api/v1/admin/platform-settings/plans | get_plan_configs_handler | N |
| PATCH | /api/v1/admin/platform-settings/plans/{plan_type} | update_plan_config_handler | N |
| POST | /api/v1/admin/auth/login | admin_login_handler | N |
| POST | /api/v1/admin/auth/verify-2fa | admin_verify_2fa_handler | N |
| POST | /api/v1/admin/auth/refresh | admin_refresh_handler | N |
| POST | /api/v1/admin/auth/change-password | change_password_handler | N |
| GET | /api/v1/admin/center-applications/ | list_admin_applications_handler | N |
| GET | /api/v1/admin/center-applications/{application_id} | get_admin_application_handler | N |
| POST | /api/v1/admin/centers/{center_id}/warn | warn_center_handler | N |
| GET | /api/v1/admin/admin-accounts/ | list_admin_accounts_handler | N |
| POST | /api/v1/admin/admin-accounts/invite | invite_admin_account_handler | N |
| POST | /api/v1/admin/admin-accounts/accept-invitation | accept_admin_invitation_handler | N |
| GET | /api/v1/admin/admin-accounts/{account_id} | get_admin_account_handler | N |
| PATCH | /api/v1/admin/admin-accounts/{account_id} | update_admin_account_handler | N |
| POST | /api/v1/admin/admin-accounts/{account_id}/lock | lock_admin_account_handler | N |
| POST | /api/v1/admin/admin-accounts/{account_id}/unlock | unlock_admin_account_handler | N |
| DELETE | /api/v1/admin/admin-accounts/{account_id} | delete_admin_account_handler | N |
| POST | /api/v1/admin/notices/attachments/upload | upload_attachment_handler | N |
| GET | /api/v1/admin/notices/{notice_id}/read-status | get_read_status_handler | N |
| GET | /api/v1/admin/notices/{notice_id}/read-status/{center_id} | get_center_read_detail_handler | N |
| GET | /api/v1/admin/cs-memos/ | list_memos_handler | N |
| GET | /api/v1/admin/cs-memos/{memo_id} | get_memo_handler | N |
| POST | /api/v1/admin/cs-memos/ | create_memo_handler | N |
| PATCH | /api/v1/admin/cs-memos/{memo_id} | update_memo_handler | N |
| DELETE | /api/v1/admin/cs-memos/bulk | bulk_delete_memos_handler | N |
| DELETE | /api/v1/admin/cs-memos/{memo_id} | delete_memo_handler | N |
| GET | /api/v1/admin/audit-logs | list_audit_logs_handler | N |
| POST | /api/v1/admin/upload/images/ | upload_image_handler | N |

Excluded (수동 분류분): account 5 app, assessment 4 app, center_assessment 5 app, center 9 app, center_application 1 app + 1 facade, notice 6 app, 외 group3 5 app + 17 facade.

---

## 모듈별 PURE 합계

| 모듈군 | PURE | 비고 |
|--------|------|------|
| client/person/institution | 27 | person·credential·institution은 facade 없이 단순 CRUD |
| platform_admin | 44 | 대부분 admin read + admin 계정/메모/감사 |
| assessment/schedule | 15 | schedule=0 |
| counseling/document | 12 | |
| field_note/form | 12 | form=0 |
| center/role/auth | 9 | |
| ai_lab/llm/agent | 3 | |
| voucher/billing/subscription | 2 | |
| notification/messaging/notice/support/upload/activity | 0 | 전부 facade/application |
| **합계** | **124** | Emits=Y 11(현재 깨짐) / Emits=N 113(테스트 가능) |
