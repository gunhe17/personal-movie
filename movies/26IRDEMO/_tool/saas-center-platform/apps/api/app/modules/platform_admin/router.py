from fastapi import APIRouter, Depends

from app.modules.platform_admin.center.router import router as center_router
from app.modules.platform_admin.center_application.router import router as center_application_router
from app.modules.platform_admin.account.router import router as account_router
from app.modules.platform_admin.auth.router import router as auth_router
from app.modules.platform_admin.assessment.router import router as assessment_router
from app.modules.platform_admin.admin_account_management.router import router as admin_account_mgmt_router
from app.modules.platform_admin.notice.router import router as notice_router
from app.modules.platform_admin.notice_read.router import router as notice_read_router
from app.modules.platform_admin.cs_memo.router import router as cs_memo_router
from app.modules.platform_admin.qna.router import router as qna_router
from app.modules.platform_admin.audit_log.router import router as audit_log_router
from app.modules.platform_admin.upload.router import router as upload_router
from app.modules.platform_admin.center_assessment.router import router as center_assessment_router
from app.modules.platform_admin.voucher.router import router as voucher_router
from app.modules.platform_admin.form.router import router as form_extraction_router
from app.modules.platform_admin.credential.router import router as credential_router
from app.modules.platform_admin.platform_settings.router import router as platform_settings_router
from app.modules.platform_admin.subscription.router import router as subscription_admin_router
from app.modules.platform_admin.auth.dependencies import get_current_admin

_auth_required = [Depends(get_current_admin)]

router = APIRouter()
router.include_router(auth_router, prefix="/auth")
# 자체 behavior.request_admin 게이트 보유 — 마운트 레벨 _auth_required 미적용(이중 게이트 방지)
router.include_router(subscription_admin_router, prefix="/subscriptions")
router.include_router(center_router, prefix="/centers", dependencies=_auth_required)
router.include_router(center_application_router, prefix="/center-applications", dependencies=_auth_required)
router.include_router(account_router, prefix="/accounts", dependencies=_auth_required)
router.include_router(assessment_router, prefix="/assessments", dependencies=_auth_required)
router.include_router(admin_account_mgmt_router, prefix="/admin-accounts", dependencies=_auth_required)
router.include_router(notice_router, prefix="/notices", dependencies=_auth_required)
router.include_router(notice_read_router, prefix="/notices", dependencies=_auth_required)
router.include_router(cs_memo_router, prefix="/cs-memos", dependencies=_auth_required)
router.include_router(qna_router, dependencies=_auth_required)
router.include_router(audit_log_router, prefix="/audit-logs", dependencies=_auth_required)
router.include_router(upload_router, prefix="/upload", dependencies=_auth_required)
router.include_router(center_assessment_router, prefix="/centers/{center_id}/center-assessments", dependencies=_auth_required)
router.include_router(voucher_router, dependencies=_auth_required)
router.include_router(form_extraction_router, dependencies=_auth_required)
router.include_router(credential_router, prefix="/credentials", dependencies=_auth_required)
router.include_router(platform_settings_router, prefix="/platform-settings", dependencies=_auth_required)
