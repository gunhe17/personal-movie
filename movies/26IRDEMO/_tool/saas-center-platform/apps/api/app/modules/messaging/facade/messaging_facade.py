from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.agent_query import merge_fields, normalize_limit, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.messaging.common.base import MessagingClient
from ..messaging.models import MessageLog
from ..messaging.repository import MessageLogRepository
from ..messaging.services.list_delivery_history import ListDeliveryHistoryService
from ..messaging.services.list_failed_recipients import ListFailedRecipientsService
from ..messaging.services.list_message_logs_by_agent_filters import (
    ListMessageLogsByAgentFiltersService,
)
from ..messaging.services.send_message import SendMessageService


# 발송 클라이언트는 프로세스 싱글톤 — 사용 시점에 직접 resolve. 생성자 주입은 테스트/크로스모듈 교체용.
class MessagingFacade:
    def __init__(
        self,
        uow: UnitOfWork,
        messaging_client: MessagingClient | None = None,
    ):
        self._uow = uow
        self._messaging_client = messaging_client

    def _client(self) -> MessagingClient:
        if self._messaging_client is None:
            from app.infrastructure.messaging.factory import get_messaging_client

            self._messaging_client = get_messaging_client()
        return self._messaging_client

    async def send(
        self,
        center_id: str,
        channel: str,
        recipient: str,
        message: str,
        template_code: str | None = None,
        title: str | None = None,
        send_link_id: str | None = None,
        send_result_id: str | None = None,
        form_send_id: str
        | None = None,  # title: sms 본문 90자 초과 시 LMS 제목이 되며 LMS로 전환
    ) -> MessageLog:
        repo = self._uow.repo(MessageLogRepository)
        service = SendMessageService(repo, self._client())
        return await service.execute(
            center_id=center_id,
            channel=channel,
            recipient=recipient,
            message=message,
            template_code=template_code,
            title=title,
            send_link_id=send_link_id,
            send_result_id=send_result_id,
            form_send_id=form_send_id,
        )

    async def get_delivery_history(
        self,
        send_link_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListDeliveryHistoryService(repo).execute(send_link_id=send_link_id)

    async def get_failed_recipients(
        self,
        send_link_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListFailedRecipientsService(repo).execute(
            send_link_id=send_link_id
        )

    async def get_delivery_history_by_result(
        self,
        send_result_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListDeliveryHistoryService(repo).execute(
            send_result_id=send_result_id
        )

    async def get_failed_recipients_by_result(
        self,
        send_result_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListFailedRecipientsService(repo).execute(
            send_result_id=send_result_id
        )

    async def get_delivery_history_by_form_send(
        self,
        form_send_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListDeliveryHistoryService(repo).execute(form_send_id=form_send_id)

    async def get_failed_recipients_by_form_send(
        self,
        form_send_id: str,
    ) -> list[MessageLog]:
        repo = self._uow.repo(MessageLogRepository)
        return await ListFailedRecipientsService(repo).execute(
            form_send_id=form_send_id
        )

    async def query_message_log(
        self,
        center_id: str,
        *,
        message_type: str | None = None,
        status: str | None = None,
        recipient: str | None = None,
        template_code: str | None = None,
        keyword: str | None = None,
        attempts_min: int | None = None,
        attempts_max: int | None = None,
        sent_from: str | None = None,
        sent_to: str | None = None,
        scheduled_from: str | None = None,
        scheduled_to: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        id: str | None = None,
        ids: list[str] | None = None,
        sort: str | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        repo = self._uow.repo(MessageLogRepository)
        rows, total = await ListMessageLogsByAgentFiltersService(repo).execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            message_type=message_type,
            status=status,
            recipient=recipient,
            template_code=template_code,
            keyword=keyword,
            attempts_min=attempts_min,
            attempts_max=attempts_max,
            sent_from=coerce_date(sent_from, "sent_from"),
            sent_to=coerce_date(sent_to, "sent_to"),
            scheduled_from=coerce_date(scheduled_from, "scheduled_from"),
            scheduled_to=coerce_date(scheduled_to, "scheduled_to"),
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        identity = ["id"]
        default = [
            "id", "message_type", "status", "recipient",
            "template_code", "sent_at", "scheduled_at", "attempts",
        ]
        available = {
            "id", "message_type", "status", "recipient",
            "template_code", "sent_at", "scheduled_at", "attempts",
            "message", "error_message",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(rows, merged, "message_log" if namespaced else ""), total
