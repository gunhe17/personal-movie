from app.core.exceptions import PermissionDeniedException, InvalidOperationException
from ..events import ClientRelationAtomic
from ..models import ClientRelation
from ..repository import ClientRelationRepository


class DeleteGuardianRelationService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        relation_id: str,
        center_id: str,
        entity_name: str = "guardian_relation",
    ) -> tuple[ClientRelationAtomic, ClientRelation]:
        # load
        relation = await self.repo.get_by_id(id=relation_id)

        # verify
        if relation.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 관계입니다")
        if relation.is_primary and relation.relation_type == "guardian":
            raise InvalidOperationException(
                "Cannot delete primary guardian. "
                "Please assign another primary guardian first."
            )

        # load
        reverse_relation = await self.repo.find_reverse_relation(
            center_id=center_id,
            client_id=relation.client_id,
            related_client_id=relation.related_client_id,
            relation_type=relation.relation_type,
        )

        # remove
        await self.repo.remove_by_id(id=relation_id)
        if reverse_relation:
            await self.repo.remove_by_id(id=reverse_relation.id)

        return ClientRelationAtomic.deleted(relation=relation, entity_name=entity_name)
