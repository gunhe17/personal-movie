from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from app.application.handlers.client_app import (
    get_app_assessment_report_handler,
    get_app_unread_count_handler,
    list_app_notification_settings_handler,
    list_app_notifications_handler,
    mark_all_app_notifications_read_handler,
    mark_app_notification_read_handler,
    register_app_push_token_handler,
    unregister_app_push_token_handler,
    upsert_app_notification_setting_handler,
    app_login_handler,
    app_refresh_handler,
    app_signup_handler,
    claim_center_link_handler,
    count_app_record_dates_handler,
    create_app_profile_handler,
    complete_app_record_media_handler,
    create_app_record_handler,
    create_app_record_media_upload_url_handler,
    delete_app_record_media_handler,
    delete_app_record_handler,
    get_app_record_handler,
    list_app_records_handler,
    move_app_record_handler,
    set_app_record_bookmark_handler,
    update_app_record_handler,
    delete_app_profile_handler,
    get_app_billable_detail_handler,
    get_app_center_detail_handler,
    get_app_link_status_handler,
    get_app_me_handler,
    get_profile_progress_handler,
    issue_app_invitation_handler,
    issue_family_invitation_handler,
    send_app_invitation_sms_handler,
    join_family_handler,
    leave_family_handler,
    list_family_members_handler,
    list_app_billables_handler,
    list_app_client_vouchers_handler,
    list_app_default_avatars_handler,
    list_app_profiles_handler,
    list_app_schedules_handler,
    request_app_schedule_change_handler,
    cancel_app_schedule_handler,
    get_app_available_slots_handler,
    merge_app_profile_handler,
    list_app_vouchers_handler,
    list_app_directory_centers_handler,
    remove_family_member_handler,
    set_app_profile_default_avatar_handler,
    update_app_profile_handler,
    upload_app_profile_image_handler,
    verify_link_invitation_handler,
)
from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    authenticate_app,
    dispatch_events,
    require_membership,
    require_permission,
    start_event_group,
)
from app.core.permissions import Permission
from app.infrastructure.storage import get_storage_client
from app.modules.notification.notification.schemas import (
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from .schemas import (
    AppAssessmentReportResponse,
    AppBillableDetailResponse,
    AppCenterDetailResponse,
    AppInvitationSmsResponse,
    AppBillableResponse,
    AppNotificationSettingItem,
    AppNotificationSettingUpdate,
    AppPushTokenRegisterRequest,
    AppPushTokenResponse,
    AppFamilyInvitationResponse,
    AppFamilyJoinRequest,
    AppFamilyJoinResponse,
    AppFamilyMemberItem,
    AppInvitationIssueRequest,
    AppInvitationResponse,
    AppLinkStatusResponse,
    AppAvailableSlotsResponse,
    AppScheduleCancelRequest,
    AppScheduleCancelResponse,
    AppScheduleChangeRequestCreate,
    AppScheduleChangeRequestResponse,
    AppLoginRequest,
    AppMeResponse,
    AppDefaultAvatarItem,
    AppProfileCreateRequest,
    AppProfileImageRequest,
    AppRecordBookmarkRequest,
    AppRecordCreateRequest,
    AppRecordDateCountResponse,
    AppRecordListResponse,
    AppRecordMediaCompleteRequest,
    AppRecordMediaResponse,
    AppRecordMediaUploadRequest,
    AppRecordMediaUploadResponse,
    AppRecordMoveRequest,
    AppRecordResponse,
    AppRecordUpdateRequest,
    AppProfileMergeRequest,
    AppProfileProgressResponse,
    AppProfileResponse,
    AppProfileUpdateRequest,
    AppRefreshRequest,
    AppScheduleItem,
    AppSignupRequest,
    AppTokenResponse,
    AppClientVoucherItem,
    AppVoucherItem,
    AppDirectoryCenterItem,
    LinkClaimRequest,
    LinkClaimResponse,
    LinkVerifyRequest,
    LinkVerifyResponse,
)

app_router = APIRouter(prefix="/app", tags=["client-app"])
staff_router = APIRouter(
    prefix="/centers/{center_id}/clients/{client_id}/app-link",
    tags=["client-app-admin"],
)


# #
# auth

@app_router.post("/auth/signup", status_code=201, response_model=AppTokenResponse)
async def app_signup(
    data: AppSignupRequest,
    *,
    request: Request,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await app_signup_handler(data, request, ctx.uow)


@app_router.post("/auth/login", response_model=AppTokenResponse)
async def app_login(
    data: AppLoginRequest,
    *,
    request: Request,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await app_login_handler(
        data, request, ctx.uow, event_group_id=ctx.event_group_id
    )


@app_router.post("/auth/refresh", response_model=AppTokenResponse)
async def app_refresh(
    data: AppRefreshRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await app_refresh_handler(data, ctx.uow)


# #
# me · profile

@app_router.get("/me", response_model=AppMeResponse)
async def app_me(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_me_handler(
        account_id=ctx.account_id,
        person_id=ctx.person_id,
        uow=ctx.uow,
    )


@app_router.get("/profiles", response_model=list[AppProfileResponse])
async def list_app_profiles(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_profiles_handler(person_id=ctx.person_id, uow=ctx.uow)


@app_router.post("/profiles", status_code=201, response_model=AppProfileResponse)
async def create_app_profile(
    data: AppProfileCreateRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await create_app_profile_handler(
        person_id=ctx.person_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.patch("/profiles/{profile_id}", response_model=AppProfileResponse)
async def update_app_profile(
    profile_id: str,
    data: AppProfileUpdateRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await update_app_profile_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.get("/profile-avatars", response_model=list[AppDefaultAvatarItem])
async def list_app_default_avatars(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_default_avatars_handler()


@app_router.patch("/profiles/{profile_id}/image", response_model=AppProfileResponse)
async def set_app_profile_default_avatar(
    profile_id: str,
    data: AppProfileImageRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await set_app_profile_default_avatar_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.post("/profiles/{profile_id}/image", response_model=AppProfileResponse)
async def upload_app_profile_image(
    profile_id: str,
    file: UploadFile = File(...),
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await upload_app_profile_image_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        file=file,
        uow=ctx.uow,
    )


@app_router.post("/profiles/{profile_id}/merge", response_model=AppProfileResponse)
async def merge_app_profile(
    profile_id: str,
    data: AppProfileMergeRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await merge_app_profile_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.delete("/profiles/{profile_id}", status_code=204)
async def delete_app_profile(
    profile_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await delete_app_profile_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        uow=ctx.uow,
    )


# #
# link

@app_router.post("/link-invitations/verify", response_model=LinkVerifyResponse)
async def verify_link_invitation(
    data: LinkVerifyRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await verify_link_invitation_handler(
        data,
        person_id=ctx.person_id,
        uow=ctx.uow,
    )


@app_router.post("/links/claim", response_model=LinkClaimResponse)
async def claim_center_link(
    data: LinkClaimRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await claim_center_link_handler(
        data,
        person_id=ctx.person_id,
        uow=ctx.uow,
    )


# #
# public catalog (비인증 — 게스트 포함. 공공 제도 정보라 개인정보 없음)

@app_router.get("/vouchers", response_model=list[AppVoucherItem])
async def list_app_vouchers(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await list_app_vouchers_handler(uow=ctx.uow)


@app_router.get("/directory-centers", response_model=list[AppDirectoryCenterItem])
async def list_app_directory_centers(
    latitude: float = Query(ge=33, le=39),
    longitude: float = Query(ge=124, le=132),
    radius_m: int = Query(3000, ge=100, le=20000),
    limit: int = Query(30, ge=1, le=100),
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await list_app_directory_centers_handler(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
        uow=ctx.uow,
    )


# #
# read projection

@app_router.get("/client-vouchers", response_model=list[AppClientVoucherItem])
async def list_app_client_vouchers(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_client_vouchers_handler(
        person_id=ctx.person_id,
        uow=ctx.uow,
    )

@app_router.get("/schedules", response_model=list[AppScheduleItem])
async def list_app_schedules(
    start: datetime,
    end: datetime,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_schedules_handler(
        person_id=ctx.person_id,
        start=start,
        end=end,
        uow=ctx.uow,
    )


@app_router.post(
    "/schedules/{schedule_id}/cancel", response_model=AppScheduleCancelResponse
)
async def cancel_app_schedule(
    schedule_id: str,
    data: AppScheduleCancelRequest | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await cancel_app_schedule_handler(
        person_id=ctx.person_id,
        schedule_id=schedule_id,
        reason=data.reason if data else None,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@app_router.get(
    "/schedules/{schedule_id}/available-slots", response_model=AppAvailableSlotsResponse
)
async def get_app_available_slots(
    schedule_id: str,
    date: str = Query(description="YYYY-MM-DD"),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_available_slots_handler(
        person_id=ctx.person_id,
        schedule_id=schedule_id,
        target_date=date_type.fromisoformat(date),
        uow=ctx.uow,
    )


@app_router.post(
    "/schedules/{schedule_id}/change-requests",
    response_model=AppScheduleChangeRequestResponse,
    status_code=201,
)
async def request_app_schedule_change(
    schedule_id: str,
    data: AppScheduleChangeRequestCreate,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await request_app_schedule_change_handler(
        person_id=ctx.person_id,
        schedule_id=schedule_id,
        start_time=data.start_time,
        reason=data.reason,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )



# #
# notification (앱 알림함 · 푸시 토큰)

@app_router.post("/push-tokens", status_code=201, response_model=AppPushTokenResponse)
async def register_app_push_token(
    data: AppPushTokenRegisterRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await register_app_push_token_handler(
        data, account_id=ctx.account_id, uow=ctx.uow
    )


# 경로 세그먼트에 토큰을 넣지 않는다 — ExponentPushToken[...] 의 대괄호가 깨진다
@app_router.delete("/push-tokens", status_code=204)
async def unregister_app_push_token(
    token: str = Query(...),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await unregister_app_push_token_handler(
        account_id=ctx.account_id, token=token, uow=ctx.uow
    )


@app_router.get("/notification-settings", response_model=list[AppNotificationSettingItem])
async def list_app_notification_settings(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_notification_settings_handler(
        account_id=ctx.account_id, uow=ctx.uow
    )


@app_router.put("/notification-settings", response_model=AppNotificationSettingItem)
async def upsert_app_notification_setting(
    data: AppNotificationSettingUpdate,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await upsert_app_notification_setting_handler(
        data, account_id=ctx.account_id, uow=ctx.uow
    )


@app_router.get("/notifications", response_model=NotificationListResponse)
async def list_app_notifications(
    category: str | None = Query(None),
    is_read: bool | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_notifications_handler(
        account_id=ctx.account_id,
        category=category,
        is_read=is_read,
        page=page,
        size=size,
        uow=ctx.uow,
    )


@app_router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_app_unread_count(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_unread_count_handler(account_id=ctx.account_id, uow=ctx.uow)


@app_router.patch("/notifications/read-all", response_model=MarkAllReadResponse)
async def mark_all_app_notifications_read(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await mark_all_app_notifications_read_handler(
        account_id=ctx.account_id, uow=ctx.uow
    )


# read-all 보다 뒤 — 앞에 두면 notification_id="read-all" 로 잡힌다
@app_router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_app_notification_read(
    notification_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await mark_app_notification_read_handler(
        event_group_id=ctx.event_group_id,
        account_id=ctx.account_id,
        notification_id=notification_id,
        uow=ctx.uow,
    )


# #
# family (가족 초대)

@app_router.post("/family/invitations", status_code=201, response_model=AppFamilyInvitationResponse)
async def issue_family_invitation(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await issue_family_invitation_handler(person_id=ctx.person_id, uow=ctx.uow)


@app_router.post("/family/join", response_model=AppFamilyJoinResponse)
async def join_family(
    data: AppFamilyJoinRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await join_family_handler(data, person_id=ctx.person_id, uow=ctx.uow)


@app_router.get("/family/members", response_model=list[AppFamilyMemberItem])
async def list_family_members(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_family_members_handler(person_id=ctx.person_id, uow=ctx.uow)


# /me 는 /{member_id} 보다 먼저 — 뒤에 두면 member_id="me" 로 잡힌다
@app_router.delete("/family/members/me", status_code=204)
async def leave_family(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await leave_family_handler(person_id=ctx.person_id, uow=ctx.uow)


@app_router.delete("/family/members/{member_id}", status_code=204)
async def remove_family_member(
    member_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await remove_family_member_handler(
        person_id=ctx.person_id, member_id=member_id, uow=ctx.uow
    )


# #
# billing

@app_router.get("/billables", response_model=list[AppBillableResponse])
async def list_app_billables(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_billables_handler(person_id=ctx.person_id, uow=ctx.uow)


@app_router.get("/billables/{billable_id}", response_model=AppBillableDetailResponse)
async def get_app_billable_detail(
    billable_id: str,
    center_id: str = Query(...),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_billable_detail_handler(
        person_id=ctx.person_id,
        billable_id=billable_id,
        center_id=center_id,
        uow=ctx.uow,
    )


@app_router.get("/profiles/{profile_id}/progress", response_model=AppProfileProgressResponse)
async def get_profile_progress(
    profile_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_profile_progress_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        uow=ctx.uow,
    )


@app_router.get("/centers/{center_id}", response_model=AppCenterDetailResponse)
async def get_app_center_detail(
    center_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_center_detail_handler(
        person_id=ctx.person_id,
        center_id=center_id,
        uow=ctx.uow,
    )


@app_router.get(
    "/assessment-tasks/{task_id}/report",
    response_model=AppAssessmentReportResponse,
)
async def get_app_assessment_report(
    task_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_assessment_report_handler(
        person_id=ctx.person_id,
        task_id=task_id,
        uow=ctx.uow,
        storage=get_storage_client(),
    )


# #
# records (원장)

@app_router.post("/records", status_code=201, response_model=AppRecordResponse)
async def create_app_record(
    data: AppRecordCreateRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await create_app_record_handler(
        person_id=ctx.person_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.get("/records", response_model=AppRecordListResponse)
async def list_app_records(
    profile_id: str | None = None,
    cursor: datetime | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    bookmarked_only: bool = False,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await list_app_records_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        cursor=cursor,
        limit=limit,
        bookmarked_only=bookmarked_only,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
        uow=ctx.uow,
    )


@app_router.get("/records/dates", response_model=AppRecordDateCountResponse)
async def count_app_record_dates(
    occurred_from: datetime,
    occurred_to: datetime,
    profile_id: str | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await count_app_record_dates_handler(
        person_id=ctx.person_id,
        profile_id=profile_id,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
        uow=ctx.uow,
    )


@app_router.get("/records/{record_id}", response_model=AppRecordResponse)
async def get_app_record(
    record_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await get_app_record_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        uow=ctx.uow,
    )


@app_router.patch("/records/{record_id}", response_model=AppRecordResponse)
async def update_app_record(
    record_id: str,
    data: AppRecordUpdateRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await update_app_record_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.delete("/records/{record_id}", status_code=204)
async def delete_app_record(
    record_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await delete_app_record_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        uow=ctx.uow,
    )


@app_router.patch("/records/{record_id}/bookmark", response_model=AppRecordResponse)
async def set_app_record_bookmark(
    record_id: str,
    data: AppRecordBookmarkRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await set_app_record_bookmark_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.patch("/records/{record_id}/profile", response_model=AppRecordResponse)
async def move_app_record(
    record_id: str,
    data: AppRecordMoveRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await move_app_record_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.post(
    "/records/{record_id}/media/upload-url",
    status_code=201,
    response_model=AppRecordMediaUploadResponse,
)
async def create_app_record_media_upload_url(
    record_id: str,
    data: AppRecordMediaUploadRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await create_app_record_media_upload_url_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.post(
    "/records/{record_id}/media/{media_id}/complete",
    response_model=AppRecordMediaResponse,
)
async def complete_app_record_media(
    record_id: str,
    media_id: str,
    data: AppRecordMediaCompleteRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    return await complete_app_record_media_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        media_id=media_id,
        data=data,
        uow=ctx.uow,
    )


@app_router.delete("/records/{record_id}/media/{media_id}", status_code=204)
async def delete_app_record_media(
    record_id: str,
    media_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_app(),
        )
    ),
):
    await delete_app_record_media_handler(
        person_id=ctx.person_id,
        record_id=record_id,
        media_id=media_id,
        uow=ctx.uow,
    )


# #
# staff (센터 콘솔)

@staff_router.post("/invitations", status_code=201, response_model=AppInvitationResponse)
async def issue_app_invitation(
    center_id: str,
    client_id: str,
    data: AppInvitationIssueRequest | None = None,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await issue_app_invitation_handler(
        center_id=center_id,
        client_id=client_id,
        actor_id=ctx.actor_id,
        event_group_id=ctx.event_group_id,
        self_link=bool(data and data.self_link),
        uow=ctx.uow,
    )


@staff_router.post("/invitations/send-sms", response_model=AppInvitationSmsResponse)
async def send_app_invitation_sms(
    center_id: str,
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
        )
    ),
):
    return await send_app_invitation_sms_handler(
        center_id=center_id,
        client_id=client_id,
        uow=ctx.uow,
    )


@staff_router.get("/status", response_model=AppLinkStatusResponse)
async def get_app_link_status(
    center_id: str,
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await get_app_link_status_handler(
        center_id=center_id,
        client_id=client_id,
        uow=ctx.uow,
    )
