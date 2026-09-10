from sqlalchemy.exc import IntegrityError

from app.core.logger import get_logger
from ..events import NotificationAtomic
from ..repository import NotificationRepository
from ..models import Notification

logger = get_logger(__name__)


class CreateNotificationService:
    def __init__(
        self,
        repo: NotificationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        recipient_id: str,
        category: str,
        event_type: str,
        title: str,
        body: str,
        priority: str = "normal",
        data: dict | None = None,
        event_ref: str | None = None,
    ) -> tuple[NotificationAtomic | None, Notification | None]:
        fields = dict(
            center_id=center_id,
            recipient_id=recipient_id,
            category=category,
            event_type=event_type,
            title=title,
            body=body,
            priority=priority,
            data=data,
            event_ref=event_ref,
        )

        if not event_ref:
            return NotificationAtomic.created(
                notification=await self.repo.add(**fields)
            )

        # verify (fast path)
        existing = await self.repo.find_by_event_ref(
            event_ref=event_ref,
            recipient_id=recipient_id,
        )
        if existing:
            logger.debug(f"중복 알림 스킵 (event_ref={event_ref})")
            return None, None

        # 동시 fan-out 중복은 (event_ref, recipient_id) unique 충돌이 된다.
        # savepoint 로 격리해 외부 배치 트랜잭션을 깨지 않고 None(skip)으로 수렴시킨다.
        try:
            async with self.repo._session.begin_nested():
                return NotificationAtomic.created(
                    notification=await self.repo.add(**fields)
                )
        except IntegrityError:
            logger.debug(f"중복 알림 스킵 (동시성, event_ref={event_ref})")
            return None, None
