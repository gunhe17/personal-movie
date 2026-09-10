from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_counseling_case_deleted_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    case_code: str,
    counselor_id: str,
) -> None:
    # 케이스는 이미 삭제됨 — 필요한 값은 전부 payload 스냅샷에서 온다(재조회 불가)
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=counselor_id,
        category="counseling",
        event_type="case_deleted",
        priority="important",
        title="상담 케이스가 삭제되었습니다",
        body=f"상담 케이스 {case_code}가 삭제되었습니다.",
        data={"case_id": case_id, "case_code": case_code},
        event_ref=f"counseling_case:{case_id}:deleted",
        atomics=atomics,
    )

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
