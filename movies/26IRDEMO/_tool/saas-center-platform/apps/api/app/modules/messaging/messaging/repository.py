from datetime import date, datetime, time

from sqlalchemy import func, or_, select

from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import MessageLog, MessageStatus, MessageType


class MessageLogRepository(PostgresRepository[MessageLog]):
    model = MessageLog

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        message_type: MessageType,
        recipient: str,
        message: str,
        template_code: str | None = None,
        status: MessageStatus = MessageStatus.PENDING,
        attempts: int = 0,
        send_link_id: uuid_str | None = None,
        send_result_id: uuid_str | None = None,
        form_send_id: uuid_str | None = None,
    ) -> MessageLog:
        return await super().add(
            MessageLog(
                center_id=center_id,
                message_type=message_type,
                recipient=recipient,
                message=message,
                template_code=template_code,
                status=status,
                attempts=attempts,
                send_link_id=send_link_id,
                send_result_id=send_result_id,
                form_send_id=form_send_id,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        message_log_id: uuid_str,
        *,
        status: MessageStatus = unset,
        lgu_message_id: str | None = unset,
        sent_at: utc_dt | None = unset,
        failed_at: utc_dt | None = unset,
        error_message: str | None = unset,
    ) -> MessageLog | None:
        return await self.update_fields(
            message_log_id,
            status=status,
            lgu_message_id=lgu_message_id,
            sent_at=sent_at,
            failed_at=failed_at,
            error_message=error_message,
        )

    # #
    # query

    @typecheck
    async def list_by_send_link_id(
        self,
        send_link_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[MessageLog.send_link_id == send_link_id],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_failed_by_send_link_id(
        self,
        send_link_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[
                MessageLog.send_link_id == send_link_id,
                MessageLog.status == MessageStatus.FAILED,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_send_result_id(
        self,
        send_result_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[MessageLog.send_result_id == send_result_id],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_failed_by_send_result_id(
        self,
        send_result_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[
                MessageLog.send_result_id == send_result_id,
                MessageLog.status == MessageStatus.FAILED,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_form_send_id(
        self,
        form_send_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[MessageLog.form_send_id == form_send_id],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_failed_by_form_send_id(
        self,
        form_send_id: uuid_str,
    ) -> list[MessageLog]:
        return await self._filter(
            where=[
                MessageLog.form_send_id == form_send_id,
                MessageLog.status == MessageStatus.FAILED,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    def _agent_where(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        message_type: str | None = None,
        status: str | None = None,
        recipient: str | None = None,
        template_code: str | None = None,
        keyword: str | None = None,
        attempts_min: int | None = None,
        attempts_max: int | None = None,
        sent_from: date | None = None,
        sent_to: date | None = None,
        scheduled_from: date | None = None,
        scheduled_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list:
        where = [
            MessageLog.center_id == center_id,
            MessageLog.deleted_at.is_(None),
        ]
        if ids:
            where.append(MessageLog.id.in_(ids))
        if message_type:
            where.append(MessageLog.message_type == message_type)
        if status:
            where.append(MessageLog.status == status)
        if recipient:
            where.append(MessageLog.recipient.ilike(f"%{recipient}%"))
        if template_code:
            where.append(MessageLog.template_code.ilike(f"%{template_code}%"))
        if keyword:
            where.append(
                or_(
                    MessageLog.message.ilike(f"%{keyword}%"),
                    MessageLog.error_message.ilike(f"%{keyword}%"),
                )
            )
        if attempts_min is not None:
            where.append(MessageLog.attempts >= attempts_min)
        if attempts_max is not None:
            where.append(MessageLog.attempts <= attempts_max)
        for col, lo, hi in (
            (MessageLog.sent_at, sent_from, sent_to),
            (MessageLog.scheduled_at, scheduled_from, scheduled_to),
        ):
            if lo:
                where.append(col >= datetime.combine(lo, time.min))
            if hi:
                where.append(col <= datetime.combine(hi, time.max))
        if date_from:
            where.append(MessageLog.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(MessageLog.created_at <= datetime.combine(date_to, time.max))
        return where

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        ids: list[str] | None = None,
        message_type: str | None = None,
        status: str | None = None,
        recipient: str | None = None,
        template_code: str | None = None,
        keyword: str | None = None,
        attempts_min: int | None = None,
        attempts_max: int | None = None,
        sent_from: date | None = None,
        sent_to: date | None = None,
        scheduled_from: date | None = None,
        scheduled_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[MessageLog]:
        where = self._agent_where(
            center_id,
            ids=ids,
            message_type=message_type,
            status=status,
            recipient=recipient,
            template_code=template_code,
            keyword=keyword,
            attempts_min=attempts_min,
            attempts_max=attempts_max,
            sent_from=sent_from,
            sent_to=sent_to,
            scheduled_from=scheduled_from,
            scheduled_to=scheduled_to,
            date_from=date_from,
            date_to=date_to,
        )
        col, descending = resolve_sort(
            sort,
            columns=frozenset({"attempts"}),
            event_columns={"sent": "sent_at", "scheduled": "scheduled_at"},
        )
        order_col = getattr(MessageLog, col)
        order = order_col.desc() if descending else order_col.asc()
        rows = await self._session.execute(
            select(MessageLog).where(*where).order_by(order).limit(limit)
        )
        return list(rows.scalars().all())

    @typecheck
    async def aggregate_in_center(
        self,
        center_id: uuid_str,
        *,
        ids: list[str] | None = None,
        message_type: str | None = None,
        status: str | None = None,
        recipient: str | None = None,
        template_code: str | None = None,
        keyword: str | None = None,
        attempts_min: int | None = None,
        attempts_max: int | None = None,
        sent_from: date | None = None,
        sent_to: date | None = None,
        scheduled_from: date | None = None,
        scheduled_to: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        where = self._agent_where(
            center_id,
            ids=ids,
            message_type=message_type,
            status=status,
            recipient=recipient,
            template_code=template_code,
            keyword=keyword,
            attempts_min=attempts_min,
            attempts_max=attempts_max,
            sent_from=sent_from,
            sent_to=sent_to,
            scheduled_from=scheduled_from,
            scheduled_to=scheduled_to,
            date_from=date_from,
            date_to=date_to,
        )
        count = await self._session.scalar(
            select(func.count()).select_from(MessageLog).where(*where)
        )
        return count or 0
