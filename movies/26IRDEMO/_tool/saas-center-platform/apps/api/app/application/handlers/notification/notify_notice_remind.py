from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.notice.facade import AdminNoticeFacade
from app.modules.center.client import MemberClient
from app.modules.person.client import PersonClient
from app.modules.notification.facade import NotificationFacade
from app.modules.event import emit

CHUNK_SIZE = 100


async def notify_notice_remind_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    notice_id: str,
) -> None:
    # load — 미열람은 발송 시점 기준으로 재집계(마커 이후 읽은 멤버는 제외)
    facade = AdminNoticeFacade(uow)
    notice = await facade.get_notice(notice_id)

    unread_pairs = await facade.aggregate_unread_members(notice_id)
    center_members: dict[str, list[str]] = {}
    for cid, mid in unread_pairs:
        center_members.setdefault(cid, []).append(mid)

    atomics = []
    # notify — event_ref가 재시도 간 안정 키라 인앱 행은 중복 생성 안 됨
    for cid, member_ids in center_members.items():
        await _notify_members_for_center(
            uow, cid, member_ids, notice_id, notice.title, atomics
        )
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        actor_type="machine",
    )


async def _notify_members_for_center(
    uow: UnitOfWork,
    center_id: str,
    member_ids: list[str],
    notice_id: str,
    notice_title: str,
    atomics: list,
) -> None:
    member_client = MemberClient(uow)
    person_client = PersonClient(uow)

    for i in range(0, len(member_ids), CHUNK_SIZE):
        chunk_ids = member_ids[i : i + CHUNK_SIZE]

        members = await member_client.list_by_ids(chunk_ids)
        if not members:
            continue

        person_ids = [m.person_id for m in members]
        persons = await person_client.list_by_ids(person_ids)
        account_ids = [p.account_id for p in persons if p.account_id]

        if not account_ids:
            continue

        facade = NotificationFacade(uow)
        created_atomics, _ = await facade.notify_bulk(
            center_id=center_id,
            recipient_ids=account_ids,
            category="system",
            event_type="notice_remind",
            title="공지사항 리마인드",
            body=notice_title,
            priority="normal",
            data={"notice_id": notice_id},
            event_ref_prefix=f"notice_remind:{notice_id}:{center_id}",
        )
        atomics.extend(created_atomics)
