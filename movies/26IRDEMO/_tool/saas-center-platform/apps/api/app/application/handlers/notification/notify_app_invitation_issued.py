from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade.center_facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    notify_accounts,
)
from app.modules.person.facade import PersonFacade


async def notify_app_invitation_issued_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    invitation_id: str,
    guardian_client_id: str,
) -> None:
    # 이미 앱 계정이 있으면 초대를 푸시로 라우팅 — 전화번호는 알림을 어디로 보낼지만
    # 정한다(자동 연결 아님, 확인·연결은 앱 유저 몫). 코드는 잠금화면에 노출하지 않고
    # navigate_to로만 실어 탭하면 코드 화면이 자동 검증한다.
    client = await ClientFacade(uow).get_client_in_center(
        center_id=center_id, client_id=guardian_client_id
    )
    if not client.phone or not client.phone.strip():
        return

    persons = await PersonFacade(uow).list_by_phone(client.phone)
    account_ids = [p.account_id for p in persons if p.account_id]
    if not account_ids:
        return

    # code는 event payload 금지(베어러 코드) — 재조회. 그새 만료·재발급이면 skip
    invitation = next(
        (
            inv
            for inv in await CenterLinkFacade(uow).list_valid_invitations(
                center_id=center_id,
                guardian_client_id=guardian_client_id,
                now=utc_now(),
            )
            if inv.id == invitation_id
        ),
        None,
    )
    if invitation is None:
        return

    center = await CenterFacade(uow).get_center(center_id)

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    targets = await notify_accounts(
        uow,
        center_id=center_id,
        account_ids=account_ids,
        category="app_link",
        event_type="invitation_received",
        title="센터 연결 초대가 도착했어요",
        body=f"{center.name}에서 앱 연결 초대를 보냈어요. 눌러서 확인해 주세요.",
        push_title="연결 초대가 도착했어요",
        push_body="눌러서 확인해 주세요.",
        data={"navigate_to": f"/code?code={invitation.code}"},
        event_ref_prefix=f"app_link_invitation:{invitation.id}",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
        if target.notification_id:
            await dispatch_guardian_notification(target)
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
