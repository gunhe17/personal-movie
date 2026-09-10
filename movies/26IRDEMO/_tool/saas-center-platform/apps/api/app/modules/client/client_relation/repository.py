from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ClientRelation


class ClientRelationRepository(PostgresRepository[ClientRelation]):
    model = ClientRelation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        related_client_id: uuid_str,
        relation_type: str,
        relation_detail: str | None = None,
        is_primary: bool = False,
    ) -> ClientRelation:
        return await super().add(
            ClientRelation(
                center_id=center_id,
                client_id=client_id,
                related_client_id=related_client_id,
                relation_type=relation_type,
                relation_detail=relation_detail,
                is_primary=is_primary,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        relation_type: str = unset,
        relation_detail: str | None = unset,
        is_primary: bool = unset,
    ) -> ClientRelation | None:
        return await self.update_fields(
            id,
            relation_type=relation_type,
            relation_detail=relation_detail,
            is_primary=is_primary,
        )

    # #
    # query

    @typecheck
    async def list_guardians(
        self,
        center_id: uuid_str,
        child_id: uuid_str,
    ) -> list[ClientRelation]:
        return await self._filter(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == child_id,
                ClientRelation.relation_type == "guardian",
            ],
            order_by="is_primary",
            descending=True,
        )

    @typecheck
    async def list_children(
        self,
        center_id: uuid_str,
        guardian_id: uuid_str,
    ) -> list[ClientRelation]:
        return await self._filter(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == guardian_id,
                ClientRelation.relation_type == "child",
            ]
        )

    @typecheck
    async def find_primary_guardian(
        self,
        center_id: uuid_str,
        child_id: uuid_str,
    ) -> ClientRelation | None:
        return await self._find(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == child_id,
                ClientRelation.relation_type == "guardian",
                ClientRelation.is_primary.is_(True),
            ]
        )

    @typecheck
    async def list_primary_guardian_relations(
        self,
        center_id: uuid_str,
        guardian_id: uuid_str,
    ) -> list[ClientRelation]:
        return await self._filter(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.related_client_id == guardian_id,
                ClientRelation.relation_type == "guardian",
                ClientRelation.is_primary.is_(True),
            ]
        )

    @typecheck
    async def exists_relation(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        related_client_id: uuid_str,
        relation_type: str,
    ) -> bool:
        return await self._count(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == client_id,
                ClientRelation.related_client_id == related_client_id,
                ClientRelation.relation_type == relation_type,
            ]
        ) > 0

    @typecheck
    async def find_reverse_relation(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        related_client_id: uuid_str,
        relation_type: str,
    ) -> ClientRelation | None:
        reverse_type = "child" if relation_type == "guardian" else "guardian"
        return await self._find(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == related_client_id,
                ClientRelation.related_client_id == client_id,
                ClientRelation.relation_type == reverse_type,
            ]
        )

    @typecheck
    async def list_by_client_ids(
        self,
        center_id: uuid_str,
        client_ids: list[str],
    ) -> list[ClientRelation]:
        if not client_ids:
            return []
        return await self._filter(
            where=[
                ClientRelation.center_id == center_id,
                ClientRelation.client_id.in_(client_ids),
            ],
            order_by="client_id",
        )
