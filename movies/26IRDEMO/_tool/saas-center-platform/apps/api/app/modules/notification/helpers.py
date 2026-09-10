"""알림 헬퍼 함수

핸들러에서 간단하게 알림을 발생시킬 수 있는 편의 함수.

1. 상담사(Member) 인앱 알림 + 외부 채널 디스패치:
   notify_members / notify_single_member
   - 이벤트 행위자(현재 반응을 유발한 member)는 수신자에서 제외 — notify_actor=True로 해제
   - in_app=False면 인앱 행 없이 외부 채널만 (리마인드처럼 로그로 쌓일 이유가 없는 알림)
   - NotificationSetting 조회 → channel_in_app=true인 수신자에게만 Notification 생성
   - 설정이 없으면 기본값 적용 (인앱 ON, 알림톡 OFF, 푸시 OFF)
   - priority="important" + channel_alarmtalk=true → AlimTalk 발송
   - channel_push=true → FCM Push 발송 (normal/important 모두)
   - 트랜잭션 외부에서 BackgroundTask로 AlimTalk + Push 발송 + NotificationLog 기록

2. 내담자(Client) SMS/알림톡: resolve_client_sms_targets
   - 트랜잭션 내부에서 Client phone 조회
   - SmsTarget 목록 반환 → 트랜잭션 외부에서 BackgroundTask로 발송

사용 패턴:
    async with uow:
        # ... 비즈니스 로직 ...

        # 상담사 인앱 알림 + 디스패치 대상 조회 (트랜잭션 내부)
        dispatch_targets = await notify_single_member(uow=uow, ...)

        # 내담자 SMS 대상 조회 (트랜잭션 내부)
        sms_targets = await resolve_client_sms_targets(
            uow=uow, client_ids=[client_id], message="검사 일정이 확정되었습니다."
        )
        await uow.commit()

    # 상담사 AlimTalk + Push 발송 (트랜잭션 외부, BackgroundTask)
    if background_tasks and dispatch_targets:
        for target in dispatch_targets:
            background_tasks.add_task(dispatch_single_notification, target)

    # SMS 발송 (트랜잭션 외부, BackgroundTask)
    for target in sms_targets:
        background_tasks.add_task(send_sms_to_client, target)
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.logger import get_logger
from app.modules.event import current_event_actor_id

from .facade import NotificationFacade
from .recipient_resolver import (
    resolve_guardian_recipients_by_client_id,
    resolve_recipients_by_member_ids,
)

logger = get_logger(__name__)


def _mask_phone(phone: str) -> str:
    """전화번호 마스킹 (로그용): 01012345678 → 010****5678"""
    if len(phone) >= 8:
        return phone[:3] + "****" + phone[-4:]
    if len(phone) >= 4:
        return "****" + phone[-4:]
    return "****"


# 상담사(Member) 알림 헬퍼


@dataclass
class MemberDispatchTarget:
    notification_id: str
    center_id: str
    recipient_id: str  # account_id
    phone: str
    person_name: str
    title: str
    body: str
    push_tokens: list[tuple[str, str]] = field(
        default_factory=list
    )  # (token, platform)
    data: dict | None = None


async def notify_members(
    uow: UnitOfWork,
    center_id: str,
    member_ids: list[str],
    category: str,
    event_type: str,
    title: str,
    body: str,
    priority: str = "normal",
    data: dict | None = None,
    event_ref_prefix: str | None = None,
    atomics: list | None = None,
    notify_actor: bool = False,
    in_app: bool = True,
) -> list[MemberDispatchTarget]:
    # 자기 액션의 알림은 자기가 받지 않는다 — 관리자가 상담사 일정을 고치면 상담사만,
    # 상담사가 스스로 고치면 아무도 받지 않는다. 행위자 없는 경로(cron)는 그대로 통과.
    if not notify_actor:
        actor_member_id = current_event_actor_id()
        if actor_member_id:
            member_ids = [m for m in member_ids if m != actor_member_id]

    if not member_ids:
        return []

    # 1. 수신자 정보 조회 (phone 포함)
    recipients = await resolve_recipients_by_member_ids(uow, member_ids)
    if not recipients:
        return []

    # 2. 수신자별 알림 설정 조회 (인앱 + 알림톡 한 번에 처리)
    from .notification_setting.repository import NotificationSettingRepository

    setting_repo = uow.repo(NotificationSettingRepository)

    # 수신자별 설정과 인앱 알림 대상 분리
    in_app_recipients = []  # channel_in_app=true인 수신자
    recipient_settings = {}  # account_id → setting (알림톡 체크용)

    for recipient in recipients:
        setting = await setting_repo.find_effective_setting(
            center_id=center_id,
            account_id=recipient.account_id,
            category=category,
            event_type=event_type,
        )
        recipient_settings[recipient.account_id] = setting

        # 설정이 없으면 기본값 = 인앱 ON
        if not setting or setting.channel_in_app:
            in_app_recipients.append(recipient)

    # 3. 인앱 알림 생성 (channel_in_app=true인 수신자만)
    facade = NotificationFacade(uow)
    notif_id_map: dict[str, str] = {}

    # Push data에 category를 type으로 자동 삽입 (모바일 딥링크 네비게이션용)
    enriched_data = dict(data) if data else {}
    if "type" not in enriched_data:
        enriched_data["type"] = category

    if in_app and in_app_recipients:
        recipient_ids = [r.account_id for r in in_app_recipients]
        created_atomics, notif_id_map = await facade.notify_bulk(
            center_id=center_id,
            recipient_ids=recipient_ids,
            category=category,
            event_type=event_type,
            title=title,
            body=body,
            priority=priority,
            data=enriched_data,
            event_ref_prefix=event_ref_prefix,
        )
        if atomics is not None:
            atomics.extend(created_atomics)

    # 4. Push 토큰 조회
    # Push는 글로벌('*') 설정 기준으로 ON/OFF 판단
    # (카테고리별 설정과 독립적으로 전체 Push 수신 여부를 제어)
    from .push_token.repository import PushTokenRepository

    push_repo = uow.repo(PushTokenRepository)

    # account_id → push_tokens 매핑
    push_token_map: dict[str, list[str]] = {}
    all_account_ids = [r.account_id for r in recipients]
    global_settings_map = await setting_repo.aggregate_by_accounts_and_category(
        center_id=center_id,
        account_ids=all_account_ids,
        category="*",
    )
    push_account_ids = [
        account_id
        for account_id in all_account_ids
        if (s := global_settings_map.get(account_id)) and s.channel_push
    ]

    if push_account_ids:
        tokens = await push_repo.list_active_by_accounts(
            center_id=center_id,
            account_ids=push_account_ids,
        )
        for t in tokens:
            push_token_map.setdefault(t.account_id, []).append((t.token, t.platform))

    # 5. 디스패치 대상 추출 (AlimTalk: important만, Push: normal+important)
    dispatch_targets: list[MemberDispatchTarget] = []

    for recipient in recipients:
        account_id = recipient.account_id
        notif_id = notif_id_map.get(account_id, "")
        setting = recipient_settings.get(account_id)

        # AlimTalk 대상: important + channel_alarmtalk + phone
        needs_alarmtalk = (
            priority == "important"
            and recipient.phone
            and setting
            and setting.channel_alarmtalk
        )

        # Push 대상: channel_push + 활성 토큰
        tokens = push_token_map.get(account_id, [])

        if needs_alarmtalk or tokens:
            dispatch_targets.append(
                MemberDispatchTarget(
                    notification_id=notif_id,
                    center_id=center_id,
                    recipient_id=account_id,
                    phone=recipient.phone or "",
                    person_name=recipient.person_name or "",
                    title=title,
                    body=body,
                    push_tokens=tokens,
                    data=enriched_data,
                )
            )

    return dispatch_targets


async def notify_single_member(
    uow: UnitOfWork,
    center_id: str,
    member_id: str,
    category: str,
    event_type: str,
    title: str,
    body: str,
    priority: str = "normal",
    data: dict | None = None,
    event_ref: str | None = None,
    atomics: list | None = None,
    notify_actor: bool = False,
    in_app: bool = True,
) -> list[MemberDispatchTarget]:
    return await notify_members(
        uow=uow,
        center_id=center_id,
        member_ids=[member_id],
        category=category,
        event_type=event_type,
        title=title,
        body=body,
        priority=priority,
        data=data,
        event_ref_prefix=event_ref,
        atomics=atomics,
        notify_actor=notify_actor,
        in_app=in_app,
    )


async def dispatch_single_notification(target: MemberDispatchTarget) -> None:
    from app.core.config import settings
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.infrastructure.messaging.factory import get_alarmtalk_service
    from app.infrastructure.messaging.factory import get_firebase_service
    from .notification_log.repository import NotificationLogRepository

    # AlimTalk 발송
    if target.phone:
        template_code = settings.KAKAO_NOTIFICATION_TEMPLATE_CODE
        if template_code:
            status = "sent"
            error_message = None
            request_payload = None
            sent_at = None

            try:
                alarmtalk = get_alarmtalk_service()
                result = await alarmtalk.send_message(
                    recipient=target.phone,
                    message=f"[{target.title}]\n{target.body}",
                    template_code=template_code,
                )
                sent_at = result.get("sent_at")
                request_payload = {"message_id": result.get("message_id")}
                logger.info(
                    f"AlimTalk dispatched to {target.person_name} "
                    f"({_mask_phone(target.phone)})"
                )
            except Exception as e:
                status = "failed"
                error_message = str(e)
                logger.error(
                    f"AlimTalk dispatch failed for {target.person_name} "
                    f"({_mask_phone(target.phone)}): {e}"
                )

            try:
                async with AsyncSessionLocal() as session:
                    log_repo = NotificationLogRepository(session)
                    await log_repo.add(
                        notification_id=target.notification_id,
                        center_id=target.center_id,
                        recipient_id=target.recipient_id,
                        channel="alarmtalk",
                        status=status,
                        error_message=error_message,
                        sent_at=sent_at,
                        request_payload=request_payload,
                    )
                    await session.commit()
            except Exception as e:
                logger.error(f"Failed to create AlimTalk NotificationLog: {e}")

    # Push 발송
    if target.push_tokens:
        firebase = get_firebase_service()
        if firebase:
            # 알림 클릭 시 이동할 링크
            link = None
            if target.data and target.data.get("navigate_to"):
                link = target.data["navigate_to"]

            # iOS 뱃지용 미읽음 수 조회
            badge_count: int | None = None
            has_ios_token = any(p == "ios" for _, p in target.push_tokens)
            if has_ios_token:
                try:
                    async with AsyncSessionLocal() as badge_session:
                        from .notification.repository import NotificationRepository

                        notif_repo = NotificationRepository(badge_session)
                        badge_count = await notif_repo.count_unread_in_center(
                            center_id=target.center_id,
                            recipient_id=target.recipient_id,
                        )
                except Exception as e:
                    logger.warning(f"Failed to get unread count for badge: {e}")

            for token, platform in target.push_tokens:
                push_status = "sent"
                push_error = None

                try:
                    result = await firebase.send_push(
                        token=token,
                        title=target.title,
                        body=target.body,
                        data=target.data,
                        link=link,
                        platform=platform,
                        badge=badge_count if platform == "ios" else None,
                    )
                    if not result.success:
                        push_status = "failed"
                        push_error = result.error

                except Exception as e:
                    push_status = "failed"
                    push_error = str(e)
                    logger.error(f"Push dispatch failed for {target.person_name}: {e}")
                    result = None

                # 토큰 무효화 + NotificationLog 기록 (단일 세션)
                try:
                    async with AsyncSessionLocal() as session:
                        # 토큰 만료/무효화 시 비활성화
                        if result and result.invalid_token:
                            from .push_token.repository import PushTokenRepository

                            push_repo = PushTokenRepository(session)
                            await push_repo.update_inactive_by_token(token)
                            logger.info(
                                f"Deactivated invalid push token: ...{token[-8:]}"
                            )

                        log_repo = NotificationLogRepository(session)
                        await log_repo.add(
                            notification_id=target.notification_id,
                            center_id=target.center_id,
                            recipient_id=target.recipient_id,
                            channel="push",
                            status=push_status,
                            error_message=push_error,
                            request_payload={"token_suffix": token[-8:]},
                        )
                        await session.commit()
                except Exception as e:
                    logger.error(
                        f"Failed to process push result for ...{token[-8:]}: {e}"
                    )


# 보호자(내담자 앱) 알림 헬퍼


@dataclass
class GuardianDispatchTarget:
    """앱 푸시 발송 대상 (트랜잭션 외부에서 사용).

    인앱 문구와 잠금화면 문구가 분리돼 있다 — NTF-01이 잠금화면에서
    아이 이름·센터 성격 노출을 금지하는데, 인앱 목록은 인증 뒤라 제약이 없다.
    """
    notification_id: str
    center_id: str
    recipient_id: str  # account_id
    push_title: str
    push_body: str
    push_tokens: list[tuple[str, str]] = field(default_factory=list)
    data: dict | None = None


async def notify_guardians(
    uow: UnitOfWork,
    center_id: str,
    client_id: str,
    category: str,
    event_type: str,
    title: str,
    body: str,
    push_title: str,
    push_body: str,
    data: dict | None = None,
    event_ref_prefix: str | None = None,
    atomics: list | None = None,
) -> list[GuardianDispatchTarget]:
    recipients = await resolve_guardian_recipients_by_client_id(
        uow, center_id=center_id, client_id=client_id
    )
    if not recipients:
        return []

    return await notify_accounts(
        uow,
        center_id=center_id,
        account_ids=[r.account_id for r in recipients],
        category=category,
        event_type=event_type,
        title=title,
        body=body,
        push_title=push_title,
        push_body=push_body,
        data=data,
        event_ref_prefix=event_ref_prefix,
        atomics=atomics,
    )


async def notify_accounts(
    uow: UnitOfWork,
    *,
    center_id: str,
    account_ids: list[str],
    category: str,
    event_type: str,
    title: str,
    body: str,
    push_title: str,
    push_body: str,
    data: dict | None = None,
    event_ref_prefix: str | None = None,
    atomics: list | None = None,
) -> list[GuardianDispatchTarget]:
    """앱 계정(account_id) 직접 지정 알림 — 아직 연결 전인 수신자(초대 등)에 쓴다."""
    from .notification_setting.repository import NotificationSettingRepository
    from .push_token.repository import PushTokenRepository

    if not account_ids:
        return []

    setting_repo = uow.repo(NotificationSettingRepository)

    in_app_account_ids = []
    for account_id in account_ids:
        setting = await setting_repo.find_effective_setting(
            account_id=account_id,
            category=category,
            center_id=center_id,
            event_type=event_type,
        )
        # 설정 부재 = 인앱 ON (직원 경로와 같은 기본값)
        if not setting or setting.channel_in_app:
            in_app_account_ids.append(account_id)

    enriched_data = dict(data) if data else {}
    enriched_data.setdefault("type", category)

    notif_id_map: dict[str, str] = {}
    if in_app_account_ids:
        created_atomics, notif_id_map = await NotificationFacade(uow).notify_bulk(
            center_id=center_id,
            recipient_ids=in_app_account_ids,
            category=category,
            event_type=event_type,
            title=title,
            body=body,
            data=enriched_data,
            event_ref_prefix=event_ref_prefix,
        )
        if atomics is not None:
            atomics.extend(created_atomics)

    global_settings = await setting_repo.aggregate_by_accounts_and_category(
        account_ids=account_ids,
        category="*",
        center_id=center_id,
    )
    push_account_ids = [
        account_id for account_id in account_ids
        if (setting := global_settings.get(account_id)) and setting.channel_push
    ]
    if not push_account_ids:
        return []

    push_repo = uow.repo(PushTokenRepository)
    tokens = await push_repo.list_active_by_accounts(
        account_ids=push_account_ids, center_id=center_id
    )
    token_map: dict[str, list[tuple[str, str]]] = {}
    for token in tokens:
        token_map.setdefault(token.account_id, []).append((token.token, token.platform))

    return [
        GuardianDispatchTarget(
            notification_id=notif_id_map.get(account_id, ""),
            center_id=center_id,
            recipient_id=account_id,
            push_title=push_title,
            push_body=push_body,
            push_tokens=token_map[account_id],
            data=enriched_data,
        )
        for account_id in push_account_ids
        if token_map.get(account_id)
    ]


async def dispatch_guardian_notification(target: GuardianDispatchTarget) -> None:
    """푸시만 — 보호자에게 알림톡은 Client.phone 경로가 따로 있다."""
    if not target.push_tokens:
        return

    from app.infrastructure.messaging.factory import get_firebase_service
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from .notification_log.repository import NotificationLogRepository

    firebase = get_firebase_service()
    if not firebase:
        return

    link = (target.data or {}).get("navigate_to")

    badge_count: int | None = None
    if any(platform == "ios" for _, platform in target.push_tokens):
        try:
            async with AsyncSessionLocal() as badge_session:
                from .notification.repository import NotificationRepository
                # 앱은 센터 구분 없는 단일 인박스 — 센터별로 세면 배지가 깜빡인다
                badge_count = await NotificationRepository(
                    badge_session
                ).count_unread_by_recipient(recipient_id=target.recipient_id)
        except Exception as e:
            logger.warning(f"Failed to get unread count for badge: {e}")

    for token, platform in target.push_tokens:
        status = "sent"
        error = None
        result = None
        try:
            result = await firebase.send_push(
                token=token,
                title=target.push_title,
                body=target.push_body,
                data=target.data,
                link=link,
                platform=platform,
                badge=badge_count if platform == "ios" else None,
            )
            if not result.success:
                status = "failed"
                error = result.error
        except Exception as e:
            status = "failed"
            error = str(e)
            logger.error(f"Guardian push dispatch failed: {e}")

        try:
            async with AsyncSessionLocal() as session:
                if result and result.invalid_token:
                    from .push_token.repository import PushTokenRepository
                    await PushTokenRepository(session).deactivate_token(token)

                await NotificationLogRepository(session).add(
                    notification_id=target.notification_id,
                    center_id=target.center_id,
                    recipient_id=target.recipient_id,
                    channel="push",
                    status=status,
                    error_message=error,
                    request_payload={"token_suffix": token[-8:]},
                )
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to process guardian push result: {e}")


# 내담자 SMS/알림톡 헬퍼


def should_send_immediate_reminder(schedule_start_utc: datetime) -> bool:
    """접수 시점에 즉시 리마인드 SMS를 보내야 하는지 판단.

    조건: 일정이 내일(KST)이고, 현재 시각이 오전 9시(KST) 이후.
    오전 9시 이전이면 크론잡이 처리하므로 False.
    모레 이후 일정이면 해당 전날 크론잡이 처리하므로 False.
    """
    from app.core.datetime_utils import KST, utc_now

    now_kst = utc_now().replace(tzinfo=timezone.utc).astimezone(KST)
    schedule_kst = schedule_start_utc.replace(tzinfo=timezone.utc).astimezone(KST)

    is_tomorrow = schedule_kst.date() == (now_kst + timedelta(days=1)).date()
    is_past_9am = now_kst.hour >= 9

    return is_tomorrow and is_past_9am


def _build_assessment_label(
    set_summary: dict | None,
    assessment_summary: list | None,
) -> str:
    """검사 세트명 또는 개별 검사명 조합.

    - 세트가 있으면 세트명 반환 (예: "디지털 디톡스 프로그램")
    - 없으면 개별 검사명 나열 (예: "K-WISC-V, MMPI-2 검사")
    - 둘 다 없으면 "검사" 기본값
    """
    if set_summary and set_summary.get("name"):
        return set_summary["name"]

    if assessment_summary:
        names = [a.get("kor_name") or a.get("eng_name", "") for a in assessment_summary]
        names = [n for n in names if n]
        if names:
            return ", ".join(names) + " 검사"

    return "검사"


def build_reminder_sms_message(
    center_name: str,
    schedule_type: str,
    schedule_start_utc: datetime,
    set_summary: dict | None = None,
    assessment_summary: list | None = None,
) -> str:
    from app.core.datetime_utils import KST

    start_kst = schedule_start_utc.replace(tzinfo=timezone.utc).astimezone(KST)
    date_label = start_kst.strftime("%Y년 %m월 %d일 %H시 %M분")

    if schedule_type == "counseling":
        type_label = "상담"
    else:
        type_label = _build_assessment_label(set_summary, assessment_summary)

    return (
        f"[{center_name}] 일정 안내\n"
        f"내일 {type_label} 일정이 예정되어 있습니다.\n"
        f"일시: {date_label}"
    )


@dataclass
class SmsTarget:
    phone: str
    client_name: str
    message: str
    client_id: str | None = None
    template_code: str | None = None
    template_variables: dict | None = None


async def claim_client_sms_send(
    schedule_id: str,
    client_id: str,
    sms_type: str,
    ttl_seconds: int = 259200,  # 3일 — 리마인드는 익일 일정용이라 재트리거/재시도는 수시간 내
) -> bool:
    """내담자 직접 SMS의 send-key(Redis SET NX). True=신규 획득(발송해야 함).

    내담자 SMS는 인앱 알림 행(event_ref)이 없어 member 반응의 in-app 게이트를 못 쓴다.
    반응 재트리거(회기추가 시 schedule_created 재emit)·lease 재claim 시 (schedule, client, type)
    당 1회로 발송을 제한한다(eventing.md §6 send-key=최적화, cache 부재 시 fail-open).
    """
    from app.infrastructure.cache.factory import get_cache_client

    cache = await get_cache_client()
    key = f"sms:sent:{sms_type}:{schedule_id}:{client_id}"
    return await cache.set_nx(key, ex=ttl_seconds)


async def resolve_client_sms_targets(
    uow: UnitOfWork,
    client_ids: list[str],
    message: str,
    template_code: str | None = None,
    template_variables: dict | None = None,
) -> list[SmsTarget]:
    if not client_ids:
        return []

    from app.modules.client.facade import ClientFacade

    client_facade = ClientFacade(uow)
    clients = await client_facade.list_clients_by_ids(client_ids)

    sms_targets: list[SmsTarget] = []
    for client in clients:
        if client.phone:
            sms_targets.append(
                SmsTarget(
                    phone=client.phone,
                    client_name=client.name,
                    message=message,
                    client_id=client.id,
                    template_code=template_code,
                    template_variables=template_variables,
                )
            )
        else:
            logger.warning(
                f"Client {client.id} ({client.name}) has no phone number, "
                "skipping SMS notification"
            )

    return sms_targets


async def send_sms_to_client(target: SmsTarget) -> None:
    from app.infrastructure.messaging.factory import get_alarmtalk_service
    from app.infrastructure.messaging.factory import get_sms_service

    # 알림톡 템플릿이 있으면 알림톡 우선
    if target.template_code:
        try:
            alarmtalk = get_alarmtalk_service()
            await alarmtalk.send_message(
                recipient=target.phone,
                message=target.message,
                template_code=target.template_code,
                variables=target.template_variables,
            )
            logger.info(
                f"AlarmTalk sent to {target.client_name} ({_mask_phone(target.phone)})"
            )
            return
        except Exception as e:
            logger.warning(
                f"AlarmTalk failed for {target.client_name}, falling back to SMS: {e}"
            )

    # SMS 발송 (알림톡 실패 시 fallback 또는 직접 발송)
    try:
        sms = get_sms_service()
        await sms.send_message(
            recipient=target.phone,
            message=target.message,
        )
        logger.info(f"SMS sent to {target.client_name} ({_mask_phone(target.phone)})")
    except Exception as e:
        logger.error(
            f"SMS send failed for {target.client_name} ({_mask_phone(target.phone)}): {e}"
        )
