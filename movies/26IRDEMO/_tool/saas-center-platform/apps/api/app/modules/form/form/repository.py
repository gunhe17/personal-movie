from datetime import date, datetime, time

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Form


class FormRepository(PostgresRepository[Form]):
    model = Form

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 50,
        status: str | None = None,
        template_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        submitted_from: date | None = None,
        submitted_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Form], int]:
        # 앵커(status/template_id/date/id) 없이는 센터 전체 제출물 스캔 금지
        if not (status or template_id or date_from or date_to or ids):
            return [], 0
        where = [Form.center_id == center_id]
        if ids:
            where.append(Form.id.in_(ids))
        if status:
            where.append(Form.status == status)
        if template_id:
            where.append(Form.template_id == template_id)
        if date_from:
            where.append(Form.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Form.created_at <= datetime.combine(date_to, time.max))
        if submitted_from:
            where.append(Form.submitted_at >= datetime.combine(submitted_from, time.min))
        if submitted_to:
            where.append(Form.submitted_at <= datetime.combine(submitted_to, time.max))
        col, descending = resolve_sort(sort, event_columns={"submitted": "submitted_at"})
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        template_id: uuid_str,
        status: str,
        created_by: uuid_str | None = None,
        verification_code: str | None = None,
    ) -> Form:
        return await super().add(
            Form(
                center_id=center_id,
                template_id=template_id,
                status=status,
                created_by=created_by,
                verification_code=verification_code,
            )
        )

    @typecheck
    async def find_by_id(self, instance_id: uuid_str) -> Form | None:
        # 게스트 링크 인증 — center 스코프 이전 단계라 id 로만 조회한다
        return await self._find(where=[self.model.id == instance_id])

    @typecheck
    async def record_failed_attempt(self, instance_id: uuid_str) -> int:
        row = await self.find_by_id(instance_id)
        if row is None:
            return 0
        row.failed_attempts += 1
        await self._session.flush()
        return row.failed_attempts

    @typecheck
    async def update_in_center(
        self,
        instance_id: uuid_str,
        center_id: uuid_str,
        *,
        status: str = unset,
        submitted_at: utc_dt | None = unset,
        submitted_by: uuid_str | None = unset,
    ) -> Form:
        await self.get_in_center(instance_id=instance_id, center_id=center_id)
        updated = await self.update_fields(
            instance_id,
            status=status,
            submitted_at=submitted_at,
            submitted_by=submitted_by,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        instance_id: uuid_str,
        center_id: uuid_str,
    ) -> Form:
        instance = await self.get_in_center(instance_id=instance_id, center_id=center_id)
        removed = await self.remove_by_id(id=instance.id)
        assert removed is not None
        return removed

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        instance_id: uuid_str,
        center_id: uuid_str,
    ) -> Form | None:
        return await self._find(
            where=[
                Form.id == instance_id,
                Form.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        instance_id: uuid_str,
        center_id: uuid_str,
    ) -> Form:
        instance = await self.find_in_center(
            instance_id=instance_id,
            center_id=center_id,
        )
        if instance is None:
            raise EntityNotFoundException(f"Form not found: {instance_id}")
        return instance

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        status: str | None = None,
        template_id: uuid_str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Form], Page]:
        where = [Form.center_id == center_id]
        if status:
            where.append(Form.status == status)
        if template_id:
            where.append(Form.template_id == template_id)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def list_by_filters(
        self,
        center_id: uuid_str,
        status: str | None = None,
        template_id: uuid_str | None = None,
        submitted_from: utc_dt | None = None,
        submitted_to: utc_dt | None = None,
        created_from: utc_dt | None = None,
        created_to: utc_dt | None = None,
        *,
        limit: int = 50,
    ) -> list[Form]:
        where = [Form.center_id == center_id]
        if status:
            where.append(Form.status == status)
        if template_id:
            where.append(Form.template_id == template_id)
        if submitted_from is not None:
            where.append(Form.submitted_at >= submitted_from)
        if submitted_to is not None:
            where.append(Form.submitted_at <= submitted_to)
        if created_from is not None:
            where.append(Form.created_at >= created_from)
        if created_to is not None:
            where.append(Form.created_at <= created_to)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def list_ids_in_center(
        self,
        instance_ids: list[str],
        center_id: uuid_str,
    ) -> list[Form]:
        if not instance_ids:
            return []
        return await self._filter(
            where=[
                Form.id.in_(instance_ids),
                Form.center_id == center_id,
            ],
            order_by="created_at",
            descending=True,
        )
