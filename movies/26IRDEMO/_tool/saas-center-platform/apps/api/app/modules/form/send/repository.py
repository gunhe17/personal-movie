from typing import Any

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FormSend


class FormSendRepository(PostgresRepository[FormSend]):
    model = FormSend

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        form_template_id: uuid_str,
        recipients: list[dict[str, Any]],
        channel: str,
    ) -> FormSend:
        return await super().add(
            FormSend(
                center_id=center_id,
                form_template_id=form_template_id,
                recipients=recipients,
                channel=channel,
            )
        )

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        send_id: uuid_str,
    ) -> FormSend | None:
        return await self._find(
            where=[
                FormSend.center_id == center_id,
                FormSend.id == send_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        send_id: uuid_str,
    ) -> FormSend:
        form_send = await self.find_in_center(
            center_id=center_id,
            send_id=send_id,
        )
        if form_send is None:
            raise EntityNotFoundException(f"FormSend not found: {send_id}")
        return form_send

    @typecheck
    async def list_by_template(
        self,
        center_id: uuid_str,
        form_template_id: uuid_str,
    ) -> list[FormSend]:
        return await self._filter(
            where=[
                FormSend.center_id == center_id,
                FormSend.form_template_id == form_template_id,
            ],
            order_by="created_at",
            descending=True,
        )
