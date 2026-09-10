from app.core.exceptions import ConflictException
from ..events import SiblingRelationAtomic
from ..repository import SiblingRelationRepository
from ..models import SiblingRelation


class CreateSiblingRelationService:
    def __init__(self, repo: SiblingRelationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        sibling_id: str,
        relation_detail: str | None,
        entity_name: str = "sibling_relation",
    ) -> tuple[SiblingRelationAtomic, SiblingRelation]:
        # verify
        if client_id == sibling_id:
            raise ConflictException("자기 자신과는 형제 관계를 생성할 수 없습니다")

        exists = await self.repo.exists_sibling(
            center_id=center_id,
            client_id=client_id,
            sibling_id=sibling_id,
        )
        if exists:
            raise ConflictException("이미 존재하는 형제 관계입니다")

        # create
        sibling_relation_ab = await self.repo.add(
            center_id=center_id,
            client_id=client_id,
            sibling_id=sibling_id,
            relation_detail=relation_detail,
        )

        reverse_detail = self._reverse_relation_detail(relation_detail)
        await self.repo.add(
            center_id=center_id,
            client_id=sibling_id,
            sibling_id=client_id,
            relation_detail=reverse_detail,
        )

        return SiblingRelationAtomic.created(relation=sibling_relation_ab, entity_name=entity_name)

    def _reverse_relation_detail(self, detail: str | None) -> str | None:
        if not detail:
            return None

        reverse_map = {
            "older_brother": "younger_brother",
            "younger_brother": "older_brother",
            "older_sister": "younger_sister",
            "younger_sister": "older_sister",
            "sibling": "sibling"
        }

        return reverse_map.get(detail, "sibling")
