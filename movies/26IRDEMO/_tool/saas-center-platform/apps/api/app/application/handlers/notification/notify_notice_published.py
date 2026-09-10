from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.client import CenterClient, MemberClient
from app.modules.person.client import PersonClient
from app.modules.notification.facade import NotificationFacade
from app.modules.event import emit

CHUNK_SIZE = 100
CENTER_PAGE_SIZE = 50


async def notify_notice_published_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    notice_id: str,
    notice_title: str,
) -> None:
    center_client = CenterClient(uow)
    atomics = []

    center_skip = 0
    while True:
        centers = await center_client.list_active(
            skip=center_skip, limit=CENTER_PAGE_SIZE
        )
        if not centers:
            break

        for center in centers:
            await _notify_center_members(
                uow, center.id, notice_id, notice_title, atomics
            )

        if len(centers) < CENTER_PAGE_SIZE:
            break
        center_skip += CENTER_PAGE_SIZE
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        actor_type="machine",
    )


async def _notify_center_members(
    uow: UnitOfWork,
    center_id: str,
    notice_id: str,
    notice_title: str,
    atomics: list,
) -> None:
    member_client = MemberClient(uow)
    person_client = PersonClient(uow)
    skip = 0
    while True:
        members = await member_client.list_by_center(
            center_id, skip=skip, limit=CHUNK_SIZE
        )
        if not members:
            break

        person_ids = [m.person_id for m in members]
        persons = await person_client.list_by_ids(person_ids)
        account_ids = [p.account_id for p in persons if p.account_id]

        if account_ids:
            facade = NotificationFacade(uow)
            # event_ref가 재시도 간 안정 키라 인앱 행은 중복 생성 안 됨
            created_atomics, _ = await facade.notify_bulk(
                center_id=center_id,
                recipient_ids=account_ids,
                category="system",
                event_type="notice_published",
                title="새 공지사항",
                body=notice_title,
                priority="normal",
                data={"notice_id": notice_id},
                event_ref_prefix=f"notice_published:{notice_id}:{center_id}",
            )
            atomics.extend(created_atomics)

        if len(members) < CHUNK_SIZE:
            break
        skip += CHUNK_SIZE
