from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import RelationResponse
from ...client_relation.repository import ClientRelationRepository
from ...sibling_relation.repository import SiblingRelationRepository
from ...client_relation.services import ListGuardiansService, ListChildrenService
from ...sibling_relation.services import ListSiblingsService
from ...profile.repository import ClientRepository
from ...profile.services import ListClientsByIdsService


async def list_relations_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    relation_category: str | None = None,
) -> list[RelationResponse]:
    relations = []

    # Guardian 관계 조회
    if relation_category is None or relation_category == "guardian":
        relation_repo = uow.repo(ClientRelationRepository)

        # 보호자 조회 (내가 자녀인 경우)
        guardian_service = ListGuardiansService(relation_repo)
        guardians = await guardian_service.execute(center_id, client_id)

        for guardian in guardians:
            relations.append(
                RelationResponse(
                    id=guardian.id,
                    relation_category="guardian",
                    center_id=guardian.center_id,
                    client_id=guardian.client_id,
                    related_client_id=guardian.related_client_id,
                    relation_type=guardian.relation_type,
                    relation_detail=guardian.relation_detail,
                    is_primary=guardian.is_primary,
                    created_at=guardian.created_at,
                )
            )

        # 자녀 조회 (내가 보호자인 경우)
        children_service = ListChildrenService(relation_repo)
        children = await children_service.execute(center_id, client_id)

        for child in children:
            relations.append(
                RelationResponse(
                    id=child.id,
                    relation_category="guardian",
                    center_id=child.center_id,
                    client_id=child.client_id,
                    related_client_id=child.related_client_id,
                    relation_type=child.relation_type,
                    relation_detail=child.relation_detail,
                    is_primary=child.is_primary,
                    created_at=child.created_at,
                )
            )

    # Sibling 관계 조회
    if relation_category is None or relation_category == "sibling":
        sibling_repo = uow.repo(SiblingRelationRepository)
        sibling_service = ListSiblingsService(sibling_repo)
        siblings = await sibling_service.execute(center_id, client_id)

        for sibling in siblings:
            relations.append(
                RelationResponse(
                    id=sibling.id,
                    relation_category="sibling",
                    center_id=sibling.center_id,
                    client_id=sibling.client_id,
                    related_client_id=sibling.sibling_id,
                    relation_detail=sibling.relation_detail,
                    created_at=sibling.created_at,
                )
            )

    # resolve
    # 상대 이름을 여기서 채우지 않으면 호출부가 관계마다 단건 조회를 부르는데,
    # 그 경로에는 담당 범위 가드(access_level=own)가 걸려 있어 보호자는 404다.
    if relations:
        clients = await ListClientsByIdsService(uow.repo(ClientRepository)).execute(
            list({relation.related_client_id for relation in relations})
        )
        names = {c.id: c.name for c in clients if c.center_id == center_id}
        for relation in relations:
            relation.related_client_name = names.get(relation.related_client_id)

    # created_at 기준 정렬
    relations.sort(key=lambda x: x.created_at, reverse=True)
    return relations


TOOL = {
    "name": "list_relations_handler",
    "permission": "read:client",
    "purpose": "내담자의 일반 관계 목록을 조회한다.",
    "keywords": ["관계 목록", "내담자 관계 조회", "relations"],
    "boundaries": "한 내담자의 관계 목록(읽기) — relation_category로 보호자/형제 필터.",
    "output": "일반 관계 목록 (RelationResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "관계를 조회할 내담자의 UUID.",
            },
            "relation_category": {
                "type": "string",
                "title": "관계 분류",
                "description": "관계 분류 필터(선택).",
            },
        },
        "required": ["client_id"],
    },
}
