from sqlalchemy import or_

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import SiblingRelation


class SiblingRelationRepository(PostgresRepository[SiblingRelation]):
    model = SiblingRelation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        sibling_id: uuid_str,
        relation_detail: str | None = None,
    ) -> SiblingRelation:
        return await super().add(
            SiblingRelation(
                center_id=center_id,
                client_id=client_id,
                sibling_id=sibling_id,
                relation_detail=relation_detail,
            )
        )

    # #
    # query

    @typecheck
    async def list_siblings(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> list[SiblingRelation]:
        return await self._filter(
            where=[
                SiblingRelation.center_id == center_id,
                SiblingRelation.client_id == client_id,
            ]
        )

    @typecheck
    async def exists_sibling(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        sibling_id: uuid_str,
    ) -> bool:
        return await self._count(
            where=[
                SiblingRelation.center_id == center_id,
                or_(
                    (SiblingRelation.client_id == client_id)
                    & (SiblingRelation.sibling_id == sibling_id),
                    (SiblingRelation.client_id == sibling_id)
                    & (SiblingRelation.sibling_id == client_id),
                ),
            ]
        ) > 0

    @typecheck
    async def find_reverse_relation(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        sibling_id: uuid_str,
    ) -> SiblingRelation | None:
        return await self._find(
            where=[
                SiblingRelation.center_id == center_id,
                SiblingRelation.client_id == sibling_id,
                SiblingRelation.sibling_id == client_id,
            ]
        )

    @typecheck
    async def list_by_client_ids(
        self,
        center_id: uuid_str,
        client_ids: list[str],
    ) -> list[SiblingRelation]:
        if not client_ids:
            return []
        return await self._filter(
            where=[
                SiblingRelation.center_id == center_id,
                SiblingRelation.client_id.in_(client_ids),
            ],
            order_by="client_id",
        )
