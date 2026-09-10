"""PURE 레이어 스윕의 엔드포인트 spec 정의 (test_11_pure_layer_sweep.py가 import).

각 spec 함수는 (api, ctx, rec)를 받아 관련 엔드포인트를 호출하고 rec에 기록한다.
call()이 예외를 잡아 server_error로 기록하므로 한 호출이 깨져도 루프는 계속된다.
"""
import uuid

from .conftest import unique

DUMMY = "00000000-0000-0000-0000-000000000000"

OK_READ = {200}
OK_READ_OR_MISSING = {200, 404}
OK_WRITE = {200, 201, 204}
OK_WRITE_OR_MISSING = {200, 201, 202, 204, 404, 409}
OK_AUTH_REJECT = {200, 400, 401, 403, 404, 422}  # bogus 자격으로 호출 — 거절도 정상


def gen_id() -> str:
    return str(uuid.uuid4())


BODIES = {
    "relation_create": {
        "relation_category": "guardian",
        "related_client_id": "<RELATED_CLIENT_ID>",
        "relation_type": "guardian",
        "relation_detail": "mother",
        "is_primary": False,
    },
    "link_request_create": {
        "person_id": "<MEMBER_ID>",
        "phone": "010-1234-5678",
        "requested_at": "2026-06-30T09:30:00Z",
    },
    "person_create": {
        "account_id": "<ACCOUNT_ID>",
        "name": "테스트",
        "phone": "010-1234-5678",
    },
    "person_update": {"name": "수정됨"},
    "credential_create": {
        "kind": "certification",
        "title": "임상심리사 1급",
        "organization": "한국심리학회",
        "metadata": {"certificate_number": "C-0001"},
    },
    "credential_update": {"title": "수정 제목"},
    "institution_create": {"name": "테스트기관"},
    "institution_update": {"phone": "02-9876-5432"},
    "center_assessment_update": {"is_active": True},
    "center_assessment_bulk": {"items": [{"assessment_id": "<ASSESSMENT_ID>", "is_active": True}]},
    "assessment_participant_add": {
        "participant_type": "client",
        "participant_id": "<CLIENT_ID>",
    },
    "assessment_session_create": {"schedule_id": DUMMY},  # schedule_id는 NOT NULL(필수)
    "assessment_session_update": {"status": "attended"},
    "share_token_create": {
        "document_id": "<DOCUMENT_ID>",
        "created_by": "<MEMBER_ID>",
        "expires_at": "2026-12-31T23:59:59",
    },
    "share_token_validate": {"token": "<TOKEN>"},
    "field_note_entry_add": {
        "entry_type": "memo",
        "content": "메모 내용",
        "timestamp_seconds": 0,
    },
    "field_note_link_schedule": {"schedule_id": "<UNIQUE>"},
    "field_note_speaker_map": {"speaker_map": {"speaker_0": "상담사"}},
    "auth_devices_revoke": {"session_id": "<UNIQUE>"},
    "note_preference_upsert": {"default_template_type": "default"},
    "admin_ai_usage_rate_config": {"tokens_per_credit": 1000},
    "admin_platform_settings_update": {"trial_duration_days": 14},
    "admin_platform_settings_plan_update": {"label": "Pro"},
    "admin_login": {"email": "<EMAIL>", "password": "<UNIQUE>"},
    "admin_verify_2fa": {"pending_token": "<TOKEN>", "code": "123456"},
    "admin_refresh": {"refresh_token": "<TOKEN>"},
    "admin_change_password": {
        "current_password": "<UNIQUE>",
        "new_password": "NewPass123!",
        "new_password_confirm": "NewPass123!",
    },
    "admin_center_warn": {"reason": "정책 위반"},
    "admin_account_invite": {
        "email": "<EMAIL>",
        "name": "관리자",
        "role": "admin",
    },
    "admin_account_accept_invitation": {"token": "<TOKEN>", "password": "NewPass123!"},
    "admin_account_update": {"role": "admin"},
    "cs_memo_create": {
        "title": "문의 제목",
        "content": "문의 내용",
        "memo_type": "inquiry",
    },
    "cs_memo_update": {"title": "수정 제목"},
    "cs_memo_bulk_delete": {"memo_ids": ["<UNIQUE>"]},
}


def subst(body, ctx: dict):
    if body is None:
        return None
    table = {
        "<CENTER_ID>": ctx.get("center_id"),
        "<CLIENT_ID>": ctx.get("client_id"),
        "<RELATED_CLIENT_ID>": ctx.get("client_id2"),
        "<ACCOUNT_ID>": ctx.get("account_id"),
        "<ASSESSMENT_ID>": ctx.get("assessment_id"),
        "<MEMBER_ID>": ctx.get("member_id"),
        "<DOCUMENT_ID>": ctx.get("document_id") or DUMMY,
        "<UNIQUE>": unique("sweep"),
        "<EMAIL>": f"{unique('sweep')}@test.com",
        "<TOKEN>": "dummy-token",
    }

    def walk(v):
        if isinstance(v, str):
            return table.get(v, v)
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        return v

    return walk(body)


def _id(resp):
    if resp is not None and resp.status_code < 300:
        try:
            return resp.json().get("id")
        except Exception:
            return None
    return None


async def call(api, ctx, rec, group, name, method, path, *,
               body_key=None, raw_body=None, headers="h", expected=OK_READ,
               emits=False, params=None, files=None, data=None):
    hdr = ctx["ah"] if headers == "ah" else ctx["h"]
    kwargs = {"headers": hdr}
    if params:
        kwargs["params"] = params
    if files is not None:
        kwargs["files"] = files
        if data is not None:
            kwargs["data"] = data
    else:
        json_body = raw_body if raw_body is not None else subst(BODIES.get(body_key), ctx)
        if json_body is not None:
            kwargs["json"] = json_body
    try:
        resp = await api.request(method, path, **kwargs)
    except Exception as e:
        rec.add_exc(group, name, method, path, e, emits)
        return None
    rec.add(group, name, method, path, resp, expected, emits)
    return resp


def C(ctx, s):
    return f"/api/v1/centers/{ctx['center_id']}{s}"


# ═══════════════════════════════════════════════════════════════════
# specs
# ═══════════════════════════════════════════════════════════════════

async def spec_client(api, ctx, rec):
    g = "client"
    cid = ctx["client_id"]
    if cid:
        await call(api, ctx, rec, g, "favorite_add", "POST",
                   C(ctx, f"/clients/{cid}/favorite"), expected=OK_WRITE_OR_MISSING)
        await call(api, ctx, rec, g, "favorite_remove", "DELETE",
                   C(ctx, f"/clients/{cid}/favorite"), expected=OK_WRITE_OR_MISSING)
        await call(api, ctx, rec, g, "relations_get", "GET",
                   C(ctx, f"/clients/{cid}/relations"), expected=OK_READ)
        r = await call(api, ctx, rec, g, "relation_create", "POST",
                       C(ctx, f"/clients/{cid}/relations"), body_key="relation_create",
                       expected=OK_WRITE, emits=True)
        rel_id = _id(r) or DUMMY
        await call(api, ctx, rec, g, "relation_delete", "DELETE",
                   C(ctx, f"/clients/relations/{rel_id}"),
                   expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "link_requests_list", "GET",
               C(ctx, "/clients/link-requests/"), expected=OK_READ)
    r = await call(api, ctx, rec, g, "link_request_create", "POST",
                   C(ctx, "/clients/link-requests"), body_key="link_request_create",
                   expected=OK_WRITE, emits=True)
    req_id = _id(r) or DUMMY
    await call(api, ctx, rec, g, "link_request_approve", "POST",
               C(ctx, f"/clients/link-requests/{req_id}/approve"),
               raw_body={"client_id": ctx.get("client_id") or DUMMY},
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "link_request_reject", "POST",
               C(ctx, f"/clients/link-requests/{DUMMY}/reject"),
               expected=OK_WRITE_OR_MISSING)


async def spec_person(api, ctx, rec):
    g = "person"
    # persons CRUD는 admin 토큰 요구(/me/credentials는 account 토큰). 시드 person 보호 위해
    # update/delete는 더미 id(admin은 ownership 우회 → 404로 도달성만 확인).
    await call(api, ctx, rec, g, "person_list", "GET", "/api/v1/persons",
               headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "person_create", "POST", "/api/v1/persons",
               body_key="person_create", headers="ah", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "person_get", "GET",
               f"/api/v1/persons/{ctx['person_id']}", expected=OK_READ)
    await call(api, ctx, rec, g, "person_update", "PATCH",
               f"/api/v1/persons/{DUMMY}", body_key="person_update",
               headers="ah", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "person_delete", "DELETE",
               f"/api/v1/persons/{DUMMY}", headers="ah", expected=OK_WRITE_OR_MISSING)


async def spec_credential(api, ctx, rec):
    g = "credential"
    base = "/api/v1/persons/me/credentials"
    await call(api, ctx, rec, g, "credential_list", "GET", base, expected=OK_READ)
    r = await call(api, ctx, rec, g, "credential_create", "POST", base,
                   body_key="credential_create", expected=OK_WRITE)
    cred = _id(r) or DUMMY
    await call(api, ctx, rec, g, "credential_update", "PATCH", f"{base}/{cred}",
               body_key="credential_update", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "credential_request_verification", "POST",
               f"{base}/{cred}/request-verification", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "credential_attachment_upload", "POST",
               f"{base}/{cred}/attachment", expected=OK_WRITE_OR_MISSING,
               files={"file": ("a.pdf", b"%PDF-1.4 dummy", "application/pdf")})
    await call(api, ctx, rec, g, "credential_attachment_download", "GET",
               f"{base}/{cred}/attachment/download", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "credential_attachment_delete", "DELETE",
               f"{base}/{cred}/attachment", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "credential_delete", "DELETE", f"{base}/{cred}",
               expected=OK_WRITE_OR_MISSING)


async def spec_institution(api, ctx, rec):
    g = "institution"
    base = "/api/v1/institutions"
    await call(api, ctx, rec, g, "institution_list", "GET", f"{base}/", expected=OK_READ)
    r = await call(api, ctx, rec, g, "institution_create", "POST", f"{base}/",
                   body_key="institution_create", expected=OK_WRITE)
    iid = _id(r) or DUMMY
    await call(api, ctx, rec, g, "institution_get", "GET", f"{base}/{iid}",
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "institution_update", "PATCH", f"{base}/{iid}",
               body_key="institution_update", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "institution_delete", "DELETE", f"{base}/{iid}",
               expected=OK_WRITE_OR_MISSING)


async def spec_assessment(api, ctx, rec):
    g = "assessment"
    aid = ctx.get("assessment_id") or DUMMY
    case = DUMMY  # 시드에 assessment-case 없음 → 더미(404 vs 500 판별)
    sess = DUMMY
    await call(api, ctx, rec, g, "assessments_list", "GET", "/api/v1/assessments",
               expected=OK_READ)
    await call(api, ctx, rec, g, "assessment_get", "GET",
               f"/api/v1/assessments/{aid}", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "send_links_list", "GET",
               C(ctx, f"/assessment-cases/{case}/send-links"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "send_results_list", "GET",
               C(ctx, f"/assessment-cases/{case}/send-results"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "center_assessment_create", "POST",
               C(ctx, f"/center-assessments/{aid}"),
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "center_assessment_update", "PATCH",
               C(ctx, f"/center-assessments/{aid}"),
               body_key="center_assessment_update",
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "center_assessment_bulk", "PATCH",
               C(ctx, "/center-assessments/batch"),
               body_key="center_assessment_bulk",
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "participants_list", "GET",
               C(ctx, f"/assessment-cases/{case}/participants"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "participant_add", "POST",
               C(ctx, f"/assessment-cases/{case}/participants"),
               body_key="assessment_participant_add", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "participant_remove", "DELETE",
               C(ctx, f"/assessment-cases/{case}/participants/client/{DUMMY}"),
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "case_complete", "POST",
               C(ctx, f"/assessment-cases/{case}/complete"),
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "sessions_list", "GET",
               C(ctx, f"/assessment-cases/{case}/assessment-sessions"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "session_get", "GET",
               C(ctx, f"/assessment-sessions/{sess}"), expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "session_create", "POST",
               C(ctx, f"/assessment-cases/{case}/assessment-sessions"),
               body_key="assessment_session_create",
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "session_update", "PATCH",
               C(ctx, f"/assessment-sessions/{sess}"),
               body_key="assessment_session_update",
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "session_attend", "POST",
               C(ctx, f"/assessment-sessions/{sess}/attend"),
               expected=OK_WRITE_OR_MISSING)


async def spec_counseling_document(api, ctx, rec):
    g = "counseling"
    case = ctx.get("counseling_case_id") or DUMMY
    real = bool(ctx.get("counseling_case_id"))
    await call(api, ctx, rec, g, "analysis_preview", "GET",
               C(ctx, f"/counseling/cases/{case}/analysis/preview"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "analysis_create", "POST",
               C(ctx, f"/counseling/cases/{case}/analysis/"),
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "analysis_latest", "GET",
               C(ctx, f"/counseling/cases/{case}/analysis/latest"),
               expected=(OK_READ_OR_MISSING))
    await call(api, ctx, rec, g, "analysis_list", "GET",
               C(ctx, f"/counseling/cases/{case}/analysis/"),
               expected=(OK_READ if real else OK_READ_OR_MISSING))
    await call(api, ctx, rec, g, "session_participant_delete", "DELETE",
               C(ctx, f"/counseling/session-participants/{DUMMY}"),
               expected=OK_WRITE_OR_MISSING)

    gd = "document"
    doc = ctx.get("document_id") or DUMMY
    await call(api, ctx, rec, gd, "documents_list", "GET",
               C(ctx, "/documents/"), expected=OK_READ)
    await call(api, ctx, rec, gd, "document_get", "GET",
               C(ctx, f"/documents/{doc}"), expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, gd, "document_accesses_by_doc", "GET",
               C(ctx, f"/document-accesses/documents/{doc}"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, gd, "document_accesses_by_account", "GET",
               C(ctx, f"/document-accesses/accounts/{ctx['account_id']}"),
               expected=OK_READ)
    cp = {"center_id": ctx["center_id"]}
    await call(api, ctx, rec, gd, "share_token_create", "POST",
               "/api/v1/document/share/share/", body_key="share_token_create",
               params=cp, expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, gd, "share_token_validate", "POST",
               "/api/v1/document/share/share/validate", body_key="share_token_validate",
               params=cp, expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, gd, "share_tokens_list", "GET",
               f"/api/v1/document/share/share/documents/{doc}",
               params=cp, expected=OK_READ_OR_MISSING)


async def spec_field_note(api, ctx, rec):
    g = "field_note"
    fid = DUMMY  # 시드 없음
    await call(api, ctx, rec, g, "fn_config", "GET",
               C(ctx, "/field-notes/config"), expected=OK_READ)
    await call(api, ctx, rec, g, "fn_unlinked", "GET",
               C(ctx, "/field-notes/unlinked"), expected=OK_READ)
    await call(api, ctx, rec, g, "fn_statuses", "GET",
               C(ctx, "/field-notes/statuses"), params={"schedule_ids": DUMMY},
               expected=OK_READ)
    await call(api, ctx, rec, g, "fn_by_schedule", "GET",
               C(ctx, f"/field-notes/by-schedule/{DUMMY}"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "fn_entry_add", "POST",
               C(ctx, f"/field-notes/{fid}/entries"), body_key="field_note_entry_add",
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "fn_audio_upload", "POST",
               C(ctx, f"/field-notes/{fid}/audio"), expected=OK_WRITE_OR_MISSING,
               files={"file": ("a.wav", b"RIFFdummy", "audio/wav")},
               data={"duration": "1.0"})
    await call(api, ctx, rec, g, "fn_audio_download_url", "GET",
               C(ctx, f"/field-notes/{fid}/audio/{DUMMY}/download-url"),
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "fn_finish", "POST",
               C(ctx, f"/field-notes/{fid}/finish"), expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "fn_link_schedule", "POST",
               C(ctx, f"/field-notes/{fid}/link-schedule"),
               body_key="field_note_link_schedule", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "fn_by_task", "GET",
               C(ctx, f"/field-notes/by-task/{DUMMY}"), expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "fn_speaker_map", "PATCH",
               C(ctx, f"/field-notes/{fid}/speaker-map"),
               body_key="field_note_speaker_map",
               expected=OK_WRITE_OR_MISSING, emits=True)
    await call(api, ctx, rec, g, "fn_delete", "DELETE",
               C(ctx, f"/field-notes/{fid}"),
               expected=OK_WRITE_OR_MISSING, emits=True)


async def spec_center_role_auth(api, ctx, rec):
    g = "auth"
    await call(api, ctx, rec, g, "check_email", "GET", "/api/v1/auth/email-availability",
               params={"email": "probe@test.com"}, expected=OK_READ)
    await call(api, ctx, rec, g, "devices_list", "GET", "/api/v1/auth/devices",
               expected=OK_READ)
    await call(api, ctx, rec, g, "devices_revoke", "POST",
               "/api/v1/auth/devices/revoke", body_key="auth_devices_revoke",
               expected=OK_WRITE_OR_MISSING)
    gc = "center"
    await call(api, ctx, rec, gc, "note_pref_get", "GET",
               C(ctx, "/note-preferences"), expected=OK_READ)
    await call(api, ctx, rec, gc, "note_pref_upsert", "PATCH",
               C(ctx, "/note-preferences"), body_key="note_preference_upsert",
               expected=OK_WRITE)
    gr = "role"
    await call(api, ctx, rec, gr, "permissions_list", "GET",
               "/api/v1/role/permissions/", expected=OK_READ)
    await call(api, ctx, rec, gr, "roles_list", "GET", "/api/v1/role/roles/",
               expected=OK_READ)
    rid = ctx.get("role_id") or DUMMY
    await call(api, ctx, rec, gr, "role_get", "GET", f"/api/v1/role/roles/{rid}",
               expected=OK_READ_OR_MISSING)


async def spec_ai_lab_llm(api, ctx, rec):
    g = "llm"
    await call(api, ctx, rec, g, "credit_rate_config", "GET",
               C(ctx, "/credit/rate-config"), expected=OK_READ)
    case = ctx.get("counseling_case_id") or DUMMY
    base = f"/api/v1/admin/ai-lab/feature-test/{ctx['center_id']}/cases/{case}"
    await call(api, ctx, rec, "ai_lab", "ft_analysis_preview", "GET",
               f"{base}/analysis/preview", headers="ah", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, "ai_lab", "ft_analysis_latest", "GET",
               f"{base}/analysis/latest", headers="ah", expected=OK_READ_OR_MISSING)


async def spec_admin_reads(api, ctx, rec):
    g = "admin_read"
    A = "/api/v1/admin"
    for sub in ("summary", "monthly", "by-model", "by-feature", "by-center",
                "rate-config", "calls"):
        await call(api, ctx, rec, g, f"ai_usage_{sub}", "GET",
                   f"{A}/ai-usage/{sub}", headers="ah", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "vouchers_list", "GET", f"{A}/vouchers",
               headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "form_extractions_list", "GET",
               f"{A}/form-extractions", headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "credentials_pending", "GET", f"{A}/credentials/",
               headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "credentials_by_account", "GET",
               f"{A}/credentials/by-account/{ctx['account_id']}", headers="ah",
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "platform_settings_get", "GET",
               f"{A}/platform-settings", headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "platform_settings_plans", "GET",
               f"{A}/platform-settings/plans", headers="ah", expected=OK_READ)
    await call(api, ctx, rec, g, "audit_logs_list", "GET", f"{A}/audit-logs",
               headers="ah", expected=OK_READ)


async def spec_admin_writes(api, ctx, rec):
    g = "admin_write"
    A = "/api/v1/admin"
    await call(api, ctx, rec, g, "ai_usage_rate_config_put", "PUT",
               f"{A}/ai-usage/rate-config", body_key="admin_ai_usage_rate_config",
               headers="ah", expected=OK_WRITE)
    await call(api, ctx, rec, g, "platform_settings_patch", "PATCH",
               f"{A}/platform-settings", body_key="admin_platform_settings_update",
               headers="ah", expected=OK_WRITE)
    await call(api, ctx, rec, g, "platform_settings_plan_patch", "PATCH",
               f"{A}/platform-settings/plans/PRO",
               body_key="admin_platform_settings_plan_update", headers="ah",
               expected=OK_WRITE_OR_MISSING)
    # auth: bogus 자격 — 거절(4xx)도 정상, 5xx만 회귀
    await call(api, ctx, rec, g, "admin_login", "POST", f"{A}/auth/login",
               body_key="admin_login", expected=OK_AUTH_REJECT)
    await call(api, ctx, rec, g, "admin_verify_2fa", "POST", f"{A}/auth/verify-2fa",
               body_key="admin_verify_2fa", expected=OK_AUTH_REJECT)
    await call(api, ctx, rec, g, "admin_refresh", "POST", f"{A}/auth/refresh",
               body_key="admin_refresh", expected=OK_AUTH_REJECT)
    await call(api, ctx, rec, g, "admin_change_password", "POST",
               f"{A}/auth/change-password", body_key="admin_change_password",
               headers="ah", expected=OK_AUTH_REJECT)
    await call(api, ctx, rec, g, "center_warn", "POST",
               f"{A}/centers/{ctx['center_id']}/warn", body_key="admin_center_warn",
               headers="ah", expected=OK_WRITE_OR_MISSING)
    # admin accounts — invite한 throwaway만 변경/삭제(인증 계정 보호)
    await call(api, ctx, rec, g, "admin_accounts_list", "GET", f"{A}/admin-accounts/",
               headers="ah", expected=OK_READ)
    r = await call(api, ctx, rec, g, "admin_account_invite", "POST",
                   f"{A}/admin-accounts/invite", body_key="admin_account_invite",
                   headers="ah", expected=OK_WRITE_OR_MISSING)
    aid = _id(r) or DUMMY
    await call(api, ctx, rec, g, "admin_account_accept", "POST",
               f"{A}/admin-accounts/accept-invitation",
               body_key="admin_account_accept_invitation", expected=OK_AUTH_REJECT)
    await call(api, ctx, rec, g, "admin_account_get", "GET",
               f"{A}/admin-accounts/{aid}", headers="ah", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "admin_account_update", "PATCH",
               f"{A}/admin-accounts/{aid}", body_key="admin_account_update",
               headers="ah", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "admin_account_lock", "POST",
               f"{A}/admin-accounts/{aid}/lock", headers="ah",
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "admin_account_unlock", "POST",
               f"{A}/admin-accounts/{aid}/unlock", headers="ah",
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "admin_account_delete", "DELETE",
               f"{A}/admin-accounts/{aid}", headers="ah",
               expected=OK_WRITE_OR_MISSING)
    # notices
    await call(api, ctx, rec, g, "notice_attachment_upload", "POST",
               f"{A}/notices/attachments/upload", headers="ah",
               expected=OK_WRITE_OR_MISSING,
               files={"file": ("a.png", b"\x89PNG dummy", "image/png")})
    await call(api, ctx, rec, g, "notice_read_status", "GET",
               f"{A}/notices/{DUMMY}/read-status", headers="ah",
               expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "notice_read_detail", "GET",
               f"{A}/notices/{DUMMY}/read-status/{ctx['center_id']}", headers="ah",
               expected=OK_READ_OR_MISSING)
    # cs-memos (standalone CRUD)
    await call(api, ctx, rec, g, "cs_memos_list", "GET", f"{A}/cs-memos/",
               headers="ah", expected=OK_READ)
    r = await call(api, ctx, rec, g, "cs_memo_create", "POST", f"{A}/cs-memos/",
                   body_key="cs_memo_create", headers="ah", expected=OK_WRITE)
    mid = _id(r) or DUMMY
    await call(api, ctx, rec, g, "cs_memo_get", "GET", f"{A}/cs-memos/{mid}",
               headers="ah", expected=OK_READ_OR_MISSING)
    await call(api, ctx, rec, g, "cs_memo_update", "PATCH", f"{A}/cs-memos/{mid}",
               body_key="cs_memo_update", headers="ah", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "cs_memo_bulk_delete", "DELETE", f"{A}/cs-memos/batch",
               raw_body={"memo_ids": [mid]}, headers="ah",
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "cs_memo_delete", "DELETE", f"{A}/cs-memos/{mid}",
               headers="ah", expected=OK_WRITE_OR_MISSING)
    # pipeline + upload (heavy/side-effect — 마지막)
    await call(api, ctx, rec, g, "pipeline_reload", "POST", f"{A}/pipeline/reload",
               headers="ah", expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "pipeline_reload_vectors", "POST",
               f"{A}/pipeline/reload-vectors", headers="ah",
               expected=OK_WRITE_OR_MISSING)
    await call(api, ctx, rec, g, "upload_image", "POST", f"{A}/upload/images/",
               headers="ah", expected=OK_WRITE_OR_MISSING,
               params={"category": "notice", "entity_id": DUMMY},
               files={"file": ("a.png", b"\x89PNG dummy", "image/png")})


SPECS = [
    ("client", "spec_client", spec_client),
    ("person", "spec_person", spec_person),
    ("credential", "spec_credential", spec_credential),
    ("institution", "spec_institution", spec_institution),
    ("assessment", "spec_assessment", spec_assessment),
    ("counseling_document", "spec_counseling_document", spec_counseling_document),
    ("field_note", "spec_field_note", spec_field_note),
    ("center_role_auth", "spec_center_role_auth", spec_center_role_auth),
    ("ai_lab_llm", "spec_ai_lab_llm", spec_ai_lab_llm),
    ("admin_reads", "spec_admin_reads", spec_admin_reads),
    ("admin_writes", "spec_admin_writes", spec_admin_writes),
]
