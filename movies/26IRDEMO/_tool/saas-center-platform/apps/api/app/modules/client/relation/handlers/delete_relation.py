from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.event import emit
from ..schemas import RelationResponse
from ...client_relation.repository import ClientRelationRepository
from ...sibling_relation.repository import SiblingRelationRepository
from ...client_relation.services import DeleteGuardianRelationService
from ...sibling_relation.services import DeleteSiblingRelationService


async def delete_relation_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    relation_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> RelationResponse:
    # 1. ClientRelation에서 먼저 조회
    relation_repo = uow.repo(ClientRelationRepository)
    guardian_relation = await relation_repo.find_by_id(relation_id)

    if guardian_relation and guardian_relation.center_id == center_id:
        # Guardian 관계 삭제 (통합 엔드포인트 → entity_name="relation")
        delete_service = DeleteGuardianRelationService(relation_repo)
        atomic, _ = await delete_service.execute(
            relation_id, center_id, entity_name="relation"
        )
        await emit(
            uow,
            "relation_deleted",
            event_group_id=event_group_id,
            atomics=[atomic],
            center_id=center_id,
            actor_id=actor_id,
        )

        return RelationResponse(
            id=guardian_relation.id,
            relation_category="guardian",
            center_id=guardian_relation.center_id,
            client_id=guardian_relation.client_id,
            related_client_id=guardian_relation.related_client_id,
            relation_type=guardian_relation.relation_type,
            relation_detail=guardian_relation.relation_detail,
            is_primary=guardian_relation.is_primary,
            created_at=guardian_relation.created_at,
        )

    # 2. SiblingRelation에서 조회
    sibling_repo = uow.repo(SiblingRelationRepository)
    sibling_relation = await sibling_repo.find_by_id(relation_id)

    if sibling_relation and sibling_relation.center_id == center_id:
        # Sibling 관계 삭제 (통합 엔드포인트 → entity_name="relation")
        delete_service = DeleteSiblingRelationService(sibling_repo)
        atomic, _ = await delete_service.execute(
            relation_id, center_id, entity_name="relation"
        )
        await emit(
            uow,
            "relation_deleted",
            event_group_id=event_group_id,
            atomics=[atomic],
            center_id=center_id,
            actor_id=actor_id,
        )

        return RelationResponse(
            id=sibling_relation.id,
            relation_category="sibling",
            center_id=sibling_relation.center_id,
            client_id=sibling_relation.client_id,
            related_client_id=sibling_relation.sibling_id,
            relation_detail=sibling_relation.relation_detail,
            created_at=sibling_relation.created_at,
        )

    # 3. 관계를 찾을 수 없음
    raise EntityNotFoundException(f"Relation {relation_id}를 찾을 수 없습니다")


TOOL = {
    "name": "delete_relation_handler",
    "permission": "delete:client",
    "purpose": "내담자 일반 관계를 삭제한다.",
    "keywords": ["delete relation", "관계 삭제", "relation 제거", "연결 해제"],
    "boundaries": "일반 관계 삭제. 생성은 create_relation_handler.",
    "output": "삭제된 관계 (RelationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "relation_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 관계",
                "description": "삭제할 관계의 UUID.",
            },
        },
        "required": ["relation_id"],
    },
}
