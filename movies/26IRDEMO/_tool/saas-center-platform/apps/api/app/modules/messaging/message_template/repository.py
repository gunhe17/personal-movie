from sqlalchemy import Select, or_, select, update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import MessageTemplate


class MessageTemplateRepository(PostgresRepository[MessageTemplate]):
    model = MessageTemplate

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str | None,
        template_type: str,
        name: str,
        content: str,
        variables: list,
        is_default: bool = False,
    ) -> MessageTemplate:
        return await super().add(
            MessageTemplate(
                center_id=center_id,
                template_type=template_type,
                name=name,
                content=content,
                variables=variables,
                is_default=is_default,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        content: str = unset,
        is_default: bool = unset,
    ) -> MessageTemplate:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            name=name,
            content=content,
            is_default=is_default,
        )
        assert updated is not None
        return updated

    @typecheck
    async def unset_default(
        self,
        center_id: uuid_str | None,
        template_type: str,
    ) -> int:
        stmt = (
            update(MessageTemplate)
            .where(MessageTemplate.template_type == template_type)
            .where(MessageTemplate.is_default.is_(True))
            .where(MessageTemplate.deleted_at.is_(None))
        )
        if center_id is not None:
            stmt = stmt.where(MessageTemplate.center_id == center_id)
        else:
            stmt = stmt.where(MessageTemplate.center_id.is_(None))
        stmt = stmt.values(is_default=False)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount

    # #
    # query

    @typecheck
    async def list_in_center(
        self,
        center_id: uuid_str,
        template_type: str | None = None,
    ) -> list[MessageTemplate]:
        where = [MessageTemplate.center_id == center_id]
        if template_type:
            where.append(MessageTemplate.template_type == template_type)
        return await self._scalars(
            self._ordered(where)
        )

    @typecheck
    async def list_system(
        self,
        template_type: str | None = None,
    ) -> list[MessageTemplate]:
        where = [MessageTemplate.center_id.is_(None)]
        if template_type:
            where.append(MessageTemplate.template_type == template_type)
        return await self._scalars(
            self._ordered(where)
        )

    @typecheck
    async def find_default_in_center(
        self,
        center_id: uuid_str,
        template_type: str,
    ) -> MessageTemplate | None:
        return await self._find(
            where=[
                MessageTemplate.center_id == center_id,
                MessageTemplate.template_type == template_type,
                MessageTemplate.is_default.is_(True),
            ],
        )

    @typecheck
    async def find_system_default(
        self,
        template_type: str,
    ) -> MessageTemplate | None:
        return await self._find(
            where=[
                MessageTemplate.center_id.is_(None),
                MessageTemplate.template_type == template_type,
                MessageTemplate.is_default.is_(True),
            ],
        )

    @typecheck
    async def find_owned(
        self,
        center_id: uuid_str | None,
        template_id: uuid_str,
    ) -> MessageTemplate | None:
        where = [MessageTemplate.id == template_id]
        if center_id is not None:
            where.append(MessageTemplate.center_id == center_id)
        else:
            where.append(MessageTemplate.center_id.is_(None))
        return await self._find(where=where)

    @typecheck
    async def get_owned(
        self,
        center_id: uuid_str | None,
        template_id: uuid_str,
    ) -> MessageTemplate:
        found = await self.find_owned(center_id=center_id, template_id=template_id)
        if found is None:
            raise EntityNotFoundException(f"양식을 찾을 수 없습니다: {template_id}")
        return found

    @typecheck
    async def find_accessible(
        self,
        center_id: uuid_str,
        template_id: uuid_str,
    ) -> MessageTemplate | None:
        return await self._find(
            where=[
                MessageTemplate.id == template_id,
                or_(
                    MessageTemplate.center_id == center_id,
                    MessageTemplate.center_id.is_(None),
                ),
            ],
        )

    # #
    # helpers

    def _ordered(self, where: list) -> Select:
        return (
            select(MessageTemplate)
            .where(MessageTemplate.deleted_at.is_(None), *where)
            .order_by(
                MessageTemplate.is_default.desc(),
                MessageTemplate.created_at.desc(),
            )
        )
