"""N-H1 회귀: reminder fan-out 은 (event_ref, recipient_id) 중복에 멱등이어야 한다.
이전엔 read-then-write 라 동시 전송 시 두 번째 add 가 IntegrityError → 공유 uow 배치 전체 롤백
(그 실행의 모든 reminder 유실). 이제 savepoint 로 격리해 중복은 None(skip)으로 수렴한다."""
from app.modules.notification.notification.repository import NotificationRepository
from app.modules.notification.notification.services.create_notification import (
    CreateNotificationService,
)

_BASE = dict(
    center_id="c1",
    recipient_id="r1",
    category="schedule",
    event_type="reminder",
    title="t",
    body="b",
)


async def test_sequential_duplicate_skips(test_session):
    repo = NotificationRepository(test_session)
    svc = CreateNotificationService(repo)

    first_atomic, first = await svc.execute(**_BASE, event_ref="ev1")
    assert first_atomic is not None
    assert first is not None

    # 같은 event_ref 재전송 → fast-path read 가 잡아 None
    second_atomic, second = await svc.execute(**_BASE, event_ref="ev1")
    assert second_atomic is None
    assert second is None


async def test_concurrent_duplicate_does_not_abort_transaction(test_session, monkeypatch):
    repo = NotificationRepository(test_session)
    svc = CreateNotificationService(repo)

    # 선행 행 존재
    await repo.add(**_BASE, event_ref="ev1")

    # fast-path read 를 강제로 miss 시켜 savepoint 충돌 경로를 탄다(동시성 모사)
    async def _miss(**kwargs):
        return None

    monkeypatch.setattr(repo, "find_by_event_ref", _miss)

    _atomic, result = await svc.execute(**_BASE, event_ref="ev1")
    assert result is None  # 충돌 → skip, 예외 없음

    # 세션이 여전히 살아있어 후속 쓰기가 가능해야 한다(배치가 깨지지 않음)
    other = await repo.add(**{**_BASE, "recipient_id": "r2"}, event_ref="ev2")
    assert other is not None
