from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FormValue


class FormValueRepository(PostgresRepository[FormValue]):
    model = FormValue

    # #
    # command

    @typecheck
    async def bulk_upsert(
        self,
        instance_id: uuid_str,
        center_id: uuid_str,
        values: list[dict],
    ) -> list[FormValue]:
        for item in values:
            stmt = (
                insert(FormValue)
                .values(
                    id=str(uuid4()),
                    center_id=center_id,
                    instance_id=instance_id,
                    field_key=item["field_key"],
                    group_index=item.get("group_index", 0),
                    value=item["value"],
                )
                .on_conflict_do_update(
                    index_elements=["instance_id", "field_key", "group_index"],
                    set_={
                        "value": item["value"],
                        "updated_at": func.now(),
                    },
                )
            )
            await self._session.execute(stmt)

        await self._session.flush()

        return await self.list_by_instance(instance_id=instance_id)

    # #
    # query

    @typecheck
    async def list_by_instance(
        self,
        instance_id: uuid_str,
    ) -> list[FormValue]:
        stmt = (
            select(FormValue)
            .where(
                FormValue.instance_id == instance_id,
                FormValue.deleted_at.is_(None),
            )
            .order_by(FormValue.field_key, FormValue.group_index)
        )
        return await self._scalars(stmt)
