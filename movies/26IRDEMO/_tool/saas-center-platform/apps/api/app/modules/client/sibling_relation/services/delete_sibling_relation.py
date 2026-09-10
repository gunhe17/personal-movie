from app.core.exceptions import PermissionDeniedException
from ..events import SiblingRelationAtomic
from ..models import SiblingRelation
from ..repository import SiblingRelationRepository


class DeleteSiblingRelationService:
    def __init__(self, repo: SiblingRelationRepository):
        self.repo = repo

    async def execute(
        self,
        relation_id: str,
        center_id: str,
        entity_name: str = "sibling_relation",
    ) -> tuple[SiblingRelationAtomic, SiblingRelation]:
        # load
        relation = await self.repo.get_by_id(id=relation_id)

        # verify
        if relation.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 관계입니다")

        # load — repo 가 client/sibling 을 스왑해 역방향을 찾는다(여기서 또 스왑 금지)
        reverse_relation = await self.repo.find_reverse_relation(
            center_id=center_id,
            client_id=relation.client_id,
            sibling_id=relation.sibling_id,
        )

        # remove
        await self.repo.remove_by_id(id=relation_id)
        if reverse_relation:
            await self.repo.remove_by_id(id=reverse_relation.id)

        return SiblingRelationAtomic.deleted(relation=relation, entity_name=entity_name)
