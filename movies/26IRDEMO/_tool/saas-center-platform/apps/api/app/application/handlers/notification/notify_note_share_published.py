from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade.counseling_session_facade import (
    CounselingSessionFacade,
)
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    notify_guardians,
)


async def notify_note_share_published_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    share_id: str,
    session_id: str,
    client_id: str,
    status: str,
    published_at: str | None,
) -> None:
    # 발행에만 반응한다 — 같은 이벤트명을 회수(unpublish)와 나눠 쓰지 않지만,
    # 라우트가 두 이름을 다 태울 경우를 대비해 상태로 한 번 더 거른다
    if status != "published":
        return

    # 앱 딥링크는 케이스 단위 화면이라 회기 → 케이스를 되짚는다
    sessions = await CounselingSessionFacade(uow).get_sessions_by_ids([session_id])
    case_id = sessions[0].counseling_case_id if sessions else None

    # notify — 잠금화면 문구는 아이 이름·센터 성격을 담지 않는다(NTF-01)
    atomics: list = []
    targets = await notify_guardians(
        uow=uow,
        center_id=center_id,
        client_id=client_id,
        category="counseling",
        event_type="note_share_published",
        title="상담 내용이 도착했어요",
        body="선생님이 남긴 상담 내용을 앱에서 확인해 주세요.",
        push_title="새로운 소식이 있어요",
        push_body="앱에서 확인해 주세요.",
        data={"session_id": session_id, "case_id": case_id},
        # 전달할 때마다 새 알림 — 키에 전달 시각을 넣어 회차를 가른다.
        # 시각은 발행 시점에 한 번 찍히므로 같은 전달의 반응 재시도에는 그대로라
        # 중복 발송은 여전히 막힌다(event_ref unique).
        event_ref_prefix=f"note_share:{share_id}:published:{published_at}",
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
