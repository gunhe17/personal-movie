from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.email.factory import get_smtp_mailer
from app.infrastructure.email.templates.login_notification import (
    login_notification_email,
)
from app.modules.auth.facade import AuthFacade
from app.modules.event import emit


async def email_login_notification_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    notification_id: str,
) -> None:
    # load
    facade = AuthFacade(uow)
    notification, account_email = await facade.find_login_notification_with_email(
        notification_id
    )
    if notification is None or account_email is None:
        return
    if notification.notified_at is not None:
        return  # 멱등 — 재시도 시 중복 발송 방지

    # send — 예외를 삼키지 않는다(반응 실패 → 워커 재시도, notified_at 가드로 재발송 무해)
    html_content, text_content = login_notification_email(
        email=account_email,
        device_info=notification.device_info,
        ip_address=notification.ip_address,
        location=notification.location,
        login_at=notification.login_at,
    )
    get_smtp_mailer().send_email(
        recipient=account_email,
        subject="[이맘때] 새 기기 로그인 알림",
        html_content=html_content,
        text_content=text_content,
    )

    atomic = await facade.mark_login_notification_notified(notification_id)
    await emit(
        uow,
        "login_notification_notified",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_type="machine",
    )
