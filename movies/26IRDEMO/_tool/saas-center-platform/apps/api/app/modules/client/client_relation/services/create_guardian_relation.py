from app.core.exceptions import ConflictException
from ..events import ClientRelationAtomic
from ..repository import ClientRelationRepository
from ..models import ClientRelation


class CreateGuardianRelationService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        related_client_id: str,
        relation_type: str,
        relation_detail: str | None,
        is_primary: bool,
        entity_name: str = "guardian_relation",
    ) -> tuple[ClientRelationAtomic, ClientRelation]:
        # verify
        if client_id == related_client_id:
            raise ConflictException("자기 자신과는 관계를 생성할 수 없습니다")
        if relation_type != "guardian":
            raise ConflictException("이 서비스는 guardian 관계만 생성합니다")

        exists = await self.repo.exists_relation(
            center_id=center_id,
            client_id=client_id,
            related_client_id=related_client_id,
            relation_type="guardian",
        )
        if exists:
            raise ConflictException("이미 존재하는 관계입니다")

        # primary
        if is_primary:
            existing_primary = await self.repo.find_primary_guardian(
                center_id=center_id,
                child_id=client_id,
            )
            if existing_primary:
                await self.repo.update_in_place(
                    existing_primary.id,
                    is_primary=False,
                )

        # create
        guardian_relation = await self.repo.add(
            center_id=center_id,
            client_id=client_id,
            related_client_id=related_client_id,
            relation_type=relation_type,
            relation_detail=relation_detail,
            is_primary=is_primary,
        )
        await self.repo.add(
            center_id=center_id,
            client_id=related_client_id,
            related_client_id=client_id,
            relation_type="child",
            relation_detail=None,
            is_primary=False,
        )

        return ClientRelationAtomic.created(relation=guardian_relation, entity_name=entity_name)
