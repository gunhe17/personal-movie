from typing import Any

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import NotificationLog


class NotificationLogRepository(PostgresRepository[NotificationLog]):
    model = NotificationLog

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        recipient_id: uuid_str,
        channel: str,
        notification_id: uuid_str | None = None,
        status: str = "pending",
        error_message: str | None = None,
        sent_at: utc_dt | None = None,
        request_payload: dict[str, Any] | None = None,
    ) -> NotificationLog:
        return await super().add(
            NotificationLog(
                center_id=center_id,
                recipient_id=recipient_id,
                channel=channel,
                notification_id=notification_id,
                status=status,
                error_message=error_message,
                sent_at=sent_at,
                request_payload=request_payload,
            )
        )
