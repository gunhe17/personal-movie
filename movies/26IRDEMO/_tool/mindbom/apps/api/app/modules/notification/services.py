"""알림 Services + NotificationPublisher

다른 모듈의 Facade에서 발송 시 NotificationPublisher.publish() 호출.
같은 UoW 세션을 공유하므로 commit은 호출자(handler) 책임 — AuditLogger와 동일 패턴.
"""
import json
import math
from typing import Any

from app.modules.notification.models import Notification
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.schemas import (
    NotificationListResponse,
    NotificationResponse,
)


def _to_json(value: dict | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str)


class NotificationPublisher:
    """알림 발송 진입점 — 다른 모듈에서 호출"""

    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def publish(
        self,
        *,
        institution_id: str,
        recipient_member_id: str,
        type: str,
        title: str,
        body: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        link_path: str | None = None,
        actor_member_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        skip_self: bool = False,
    ) -> Notification | None:
        """알림 1건 생성

        Args:
            skip_self: True이면 actor_member_id == recipient_member_id 인 경우 발송 생략
        """
        if skip_self and actor_member_id == recipient_member_id:
            return None

        return await self.repo.create({
            "institution_id": institution_id,
            "recipient_member_id": recipient_member_id,
            "type": type,
            "title": title,
            "body": body,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "link_path": link_path,
            "actor_member_id": actor_member_id,
            "metadata_json": _to_json(metadata),
        })


class ListNotificationsService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        recipient_member_id: str,
        *,
        page: int = 1,
        size: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        skip = (page - 1) * size
        items, total = await self.repo.list_for_member(
            institution_id, recipient_member_id,
            skip=skip, limit=size, unread_only=unread_only,
        )
        unread_count = await self.repo.count_unread(institution_id, recipient_member_id)
        return NotificationListResponse(
            items=[NotificationResponse.model_validate(it) for it in items],
            total=total,
            unread_count=unread_count,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )


class GetUnreadCountService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self, institution_id: str, recipient_member_id: str
    ) -> int:
        return await self.repo.count_unread(institution_id, recipient_member_id)


class MarkAsReadService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        recipient_member_id: str,
        notification_id: str,
    ) -> int:
        return await self.repo.mark_one_read(
            institution_id, recipient_member_id, notification_id
        )


class MarkAllAsReadService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    async def execute(
        self, institution_id: str, recipient_member_id: str
    ) -> int:
        return await self.repo.mark_all_read(institution_id, recipient_member_id)
