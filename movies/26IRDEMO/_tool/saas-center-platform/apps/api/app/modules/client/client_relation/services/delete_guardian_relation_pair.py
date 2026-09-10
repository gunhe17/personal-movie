from ..events import ClientRelationAtomic
from ..models import ClientRelation
from ..repository import ClientRelationRepository


class DeleteGuardianRelationPairService:
    def __init__(
        self,
        repo: ClientRelationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        relation: ClientRelation,
    ) -> tuple[ClientRelationAtomic, ClientRelation]:
        # remove (primary-guard 우회 양방향 삭제 — 관계 교체·전체 동기화 경로 전용,
        # 단건 삭제의 주 보호자 보호는 DeleteGuardianRelationService가 정본)
        await self.repo.remove_by_id(relation.id)

        reverse_relation = await self.repo.find_reverse_relation(
            center_id=center_id,
            client_id=relation.client_id,
            related_client_id=relation.related_client_id,
            relation_type="guardian",
        )
        if reverse_relation:
            await self.repo.remove_by_id(reverse_relation.id)

        return ClientRelationAtomic.deleted(
            relation=relation, entity_name="guardian_relation"
        )
