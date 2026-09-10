from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.auth.client import AccountClient
from app.modules.center.client import MemberClient
from app.modules.person.client import PersonClient
from app.modules.platform_admin.inquiry.facade import InquiryFacade
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_inquiry_answered_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    inquiry_id: str,
) -> None:
    # load — 발신자 이메일 → 센터 멤버 역추적(비멤버 발신이면 no-op)
    inquiry = await InquiryFacade(uow).get_inquiry(inquiry_id)
    if not inquiry.center_id or not inquiry.sender_email:
        return
    account = await AccountClient(uow).find_by_email(inquiry.sender_email)
    if not account:
        return
    person = await PersonClient(uow).find_by_account_id(account.id)
    if not person:
        return
    member = await MemberClient(uow).find_by_person(inquiry.center_id, person.id)
    if not member:
        return

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=inquiry.center_id,
        member_id=member.id,
        category="system",
        event_type="inquiry_answered",
        priority="normal",
        title="문의 답변이 등록되었습니다",
        body=inquiry.subject[:50],
        data={"tag": "inquiry_answered", "inquiry_id": inquiry.id},
        event_ref=f"inquiry:{inquiry.id}:answered",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
        if target.notification_id:
            await dispatch_single_notification(target)
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
