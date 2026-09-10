from __future__ import annotations

from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.modules import routers
from app.server import exception, lifecycle, middleware, system
from app.server.server import Router, saas_center_api


# #
# server

server = saas_center_api()


# #
# lifecycle

server.startup(lifecycle.start_logging)
if settings.APP_ENV == "development":
    server.startup(lifecycle.create_schema)
server.startup(lifecycle.seed_system_templates)
server.startup(lifecycle.load_plan_config_cache)
server.startup(lifecycle.open_cache_client)
server.startup(lifecycle.wire_job_runner)
server.startup(lifecycle.start_scheduler)

server.shutdown(lifecycle.stop_scheduler)
server.shutdown(lifecycle.close_cache_client)
server.shutdown(lifecycle.close_database)


# #
# middleware

server.middleware(middleware.cors())
server.middleware(middleware.permission_version())
server.middleware(middleware.request_logging())


# #
# exception

for handler in exception.domain_handlers():
    server.exception_handler(handler)

server.exception_handler(exception.fallback())


# #
# router

# system
server.router(Router(router=system.router))

# domain
server.router(Router(router=routers.person_router, prefix="/api/v1"))
server.router(Router(router=routers.person_credential_router, prefix="/api/v1"))
server.router(Router(router=routers.auth_router, prefix="/api/v1"))
server.router(Router(router=routers.center_center_router, prefix="/api/v1"))
server.router(Router(router=routers.center_center_application_router, prefix="/api/v1"))
server.router(Router(router=routers.center_room_router, prefix="/api/v1"))
server.router(Router(router=routers.center_center_operating_time_router, prefix="/api/v1"))
server.router(Router(router=routers.center_center_non_operating_time_router, prefix="/api/v1"))
server.router(Router(router=routers.center_member_router, prefix="/api/v1"))
server.router(Router(router=routers.center_member_working_time_router, prefix="/api/v1"))
server.router(Router(router=routers.center_member_non_working_time_router, prefix="/api/v1"))
server.router(Router(router=routers.center_me_router, prefix="/api/v1"))
server.router(Router(router=routers.center_program_router, prefix="/api/v1"))
server.router(Router(router=routers.center_program_member_router, prefix="/api/v1"))
server.router(Router(router=routers.center_center_note_preference_router, prefix="/api/v1"))
# RolePermission — 센터 컨텍스트 URL(/centers/{center_id}/roles)이라 center 뒤에 등록(매칭 순서 보존)
server.router(Router(router=routers.role_permission_router, prefix="/api/v1/centers/{center_id}/roles"))
server.router(Router(router=routers.institution_router, prefix="/api/v1"))
server.router(Router(router=routers.client_favorite_router, prefix="/api/v1"))
server.router(Router(router=routers.client_profile_router, prefix="/api/v1"))
server.router(Router(router=routers.client_relation_router, prefix="/api/v1"))
server.router(Router(router=routers.client_link_router, prefix="/api/v1"))
server.router(Router(router=routers.client_resource_router, prefix="/api/v1"))
server.router(Router(router=routers.care_board_router, prefix="/api/v1"))
server.router(Router(router=routers.client_app_router, prefix="/api/v1"))
server.router(Router(router=routers.client_app_staff_router, prefix="/api/v1"))
server.router(Router(router=routers.role_permission_catalog_router, prefix="/api/v1"))
server.router(Router(router=routers.role_role_router, prefix="/api/v1"))
server.router(Router(router=routers.document_document_router, prefix="/api/v1"))
server.router(Router(router=routers.document_document_access_router, prefix="/api/v1"))
server.router(Router(router=routers.document_share_token_router, prefix="/api/v1"))
server.router(Router(router=routers.schedule_router, prefix="/api/v1"))
server.router(Router(router=routers.schedule_home_router, prefix="/api/v1"))
server.router(Router(router=routers.schedule_change_request_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_center_assessment_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_set_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_package_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_case_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_case_participant_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_task_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_assessment_session_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_send_link_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_send_result_router, prefix="/api/v1"))
server.router(Router(router=routers.counseling_case_analysis_router, prefix="/api/v1"))
server.router(Router(router=routers.counseling_note_ai_draft_router, prefix="/api/v1")) # counseling_note_router를 case_router보다 먼저 등록 (정적 /counseling/notes가 case_id="notes"로 가로채는 충돌 방지 — FastAPI는 등록 순서로 매칭).
server.router(Router(router=routers.counseling_note_share_router, prefix="/api/v1"))
server.router(Router(router=routers.counseling_note_router, prefix="/api/v1"))
server.router(Router(router=routers.counseling_case_router, prefix="/api/v1"))
server.router(Router(router=routers.counseling_session_router, prefix="/api/v1"))
server.router(Router(router=routers.upload_image_router, prefix="/api/v1/upload"))
server.router(Router(router=routers.form_template_router, prefix="/api/v1"))
server.router(Router(router=routers.form_instance_router, prefix="/api/v1"))
server.router(Router(router=routers.form_send_router, prefix="/api/v1"))
server.router(Router(router=routers.activity_router, prefix="/api/v1"))
server.router(Router(router=routers.notification_notification_router, prefix="/api/v1"))
server.router(Router(router=routers.notification_push_token_router, prefix="/api/v1"))
server.router(Router(router=routers.notification_setting_router, prefix="/api/v1"))
server.router(Router(router=routers.support_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_send_result_public_router, prefix="/api/v1"))
server.router(Router(router=routers.assessment_send_link_public_router, prefix="/api/v1"))
server.router(Router(router=routers.form_link_public_router, prefix="/api/v1"))
server.router(Router(router=routers.notice_router, prefix="/api/v1"))
server.router(Router(router=routers.field_note_router, prefix="/api/v1"))
server.router(Router(router=routers.field_note_pipeline_router, prefix="/api/v1"))
server.router(Router(router=routers.field_note_streaming_router, prefix="/api/v1"))
server.router(Router(router=routers.billing_price_list_router, prefix="/api/v1"))
server.router(Router(router=routers.billing_billable_router, prefix="/api/v1"))
server.router(Router(router=routers.billing_payment_router, prefix="/api/v1"))
server.router(Router(router=routers.voucher_center_router, prefix="/api/v1"))
server.router(Router(router=routers.voucher_client_router, prefix="/api/v1"))
server.router(Router(router=routers.messaging_router, prefix="/api/v1"))
server.router(Router(router=routers.platform_admin_router, prefix="/api/v1/admin"))
server.router(Router(router=routers.messaging_admin_router, prefix="/api/v1/admin"))
server.router(Router(router=routers.llm_router, prefix="/api/v1"))
server.router(Router(router=routers.subscription_center_router, prefix="/api/v1"))
server.router(Router(router=routers.subscription_admin_router, prefix="/api/v1"))
server.router(Router(router=routers.subscription_webhook_router, prefix="/api/v1"))
server.router(Router(router=routers.subscription_internal_router, prefix="/api/v1"))

# *develop-only
if settings.APP_ENV != "production":
    server.router(Router(router=system.schema_map_router))
    server.router(Router(router=routers.assistant_conversation_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_prompt_version_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_experiment_run_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_production_config_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_sample_dataset_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_experiment_group_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_metadata_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_playground_router, prefix="/api/v1"))
    server.router(Router(router=routers.ai_lab_feature_test_router, prefix="/api/v1"))


# #
# app

app = server.app()


# + prometheus
(
    Instrumentator(
        excluded_handlers=[
            "^/health$",
            "^/metrics$",
            "^/$",
            "^/openapi.json$",
            "^/redoc$",
            "^/docs$",
        ],
        should_group_status_codes=False,
    )
    .instrument(app)
    .expose(app)
)