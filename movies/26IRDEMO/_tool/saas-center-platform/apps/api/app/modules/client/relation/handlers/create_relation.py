from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit
from ..schemas import RelationCreateRequest, RelationResponse
from ...client_relation.repository import ClientRelationRepository
from ...sibling_relation.repository import SiblingRelationRepository
from ...client_relation.services import CreateGuardianRelationService
from ...sibling_relation.services import CreateSiblingRelationService
from ...profile.repository import ClientRepository


async def create_relation_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    data: RelationCreateRequest,
    uow: UnitOfWork,
    actor_id: str | None,
) -> RelationResponse:
    # Repository 획득
    client_repo = uow.repo(ClientRepository)

    # 센터 간 관계 금지 검증
    client = await client_repo.get_by_id(client_id)
    related_client = await client_repo.get_by_id(data.related_client_id)

    # 두 Client 모두 같은 센터에 속해야 함
    if client.center_id != center_id or related_client.center_id != center_id:
        raise InvalidOperationException(
            "Client 간 관계는 같은 센터 내에서만 생성 가능합니다"
        )

    # Category에 따라 Service 분기 (통합 엔드포인트 → entity_name="relation")
    if data.relation_category == "guardian":
        # Guardian 관계 생성
        relation_repo = uow.repo(ClientRelationRepository)
        create_service = CreateGuardianRelationService(relation_repo)

        atomic, relation = await create_service.execute(
            center_id=center_id,
            client_id=client_id,
            related_client_id=data.related_client_id,
            relation_type=data.relation_type,
            relation_detail=data.relation_detail,
            is_primary=data.is_primary,
            entity_name="relation",
        )

        # 응답 조립
        response = RelationResponse(
            id=relation.id,
            relation_category="guardian",
            center_id=relation.center_id,
            client_id=relation.client_id,
            related_client_id=relation.related_client_id,
            relation_type=relation.relation_type,
            relation_detail=relation.relation_detail,
            is_primary=relation.is_primary,
            created_at=relation.created_at,
        )

    elif data.relation_category == "sibling":
        # Sibling 관계 생성
        sibling_repo = uow.repo(SiblingRelationRepository)
        create_service = CreateSiblingRelationService(sibling_repo)

        atomic, sibling = await create_service.execute(
            center_id=center_id,
            client_id=client_id,
            sibling_id=data.related_client_id,
            relation_detail=data.relation_detail,
            entity_name="relation",
        )

        # 응답 조립
        response = RelationResponse(
            id=sibling.id,
            relation_category="sibling",
            center_id=sibling.center_id,
            client_id=sibling.client_id,
            related_client_id=sibling.sibling_id,
            relation_detail=sibling.relation_detail,
            created_at=sibling.created_at,
        )

    else:
        raise InvalidOperationException(
            f"지원하지 않는 relation_category: {data.relation_category}"
        )

    await emit(
        uow,
        "client_relation_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return response


TOOL = {
    "name": 'create_relation_handler',
    "permission": "write:client",
    "purpose": '내담자에게 일반 관계를 생성한다.',
    "keywords": ['create relation', '관계 생성', '내담자 관계 추가', 'relation 생성'],
    "boundaries": '내담자 일반 관계 생성. 보호자는 create_guardian_relation_handler, 형제는 create_sibling_relation_handler.',
    "output": '생성된 관계 (RelationResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'client_id': {'type': 'string', 'format': 'uuid', 'title': '대상 내담자', 'description': '관계를 추가할 내담자의 UUID.'},
            'relation_category': {'description': '관계 카테고리: guardian(보호자-자녀)/sibling(형제자매).', 'enum': ['guardian', 'sibling'], 'title': '관계 카테고리', 'type': 'string'},
            'related_client_id': {'description': '관계 대상 내담자의 UUID.', 'title': '관계 대상', 'type': 'string'},
            'relation_type': {'anyOf': [{'$ref': '#/$defs/RelationType'}, {'type': 'null'}], 'default': None, 'description': '관계 유형(guardian일 때만: guardian/child).'},
            'relation_detail': {'anyOf': [{'$ref': '#/$defs/GuardianRelationDetail'}, {'$ref': '#/$defs/SiblingRelationDetail'}, {'type': 'null'}], 'default': None, 'description': '관계 상세(보호자/형제 세부 관계).', 'title': '관계 상세'},
            'is_primary': {'default': False, 'description': '주 보호자 여부(guardian일 때만, 기본 False).', 'title': '주 보호자', 'type': 'boolean'},
        },
        "$defs": {'GuardianRelationDetail': {'enum': ['mother', 'father', 'grandmother', 'grandfather', 'aunt', 'uncle', 'social_worker', 'foster_parent', 'legal_guardian', 'caregiver'], 'title': 'GuardianRelationDetail', 'type': 'string'}, 'RelationType': {'enum': ['guardian', 'child'], 'title': 'RelationType', 'type': 'string'}, 'SiblingRelationDetail': {'enum': ['older_brother', 'younger_brother', 'older_sister', 'younger_sister', 'sibling'], 'title': 'SiblingRelationDetail', 'type': 'string'}},
        "required": ['client_id', 'relation_category', 'related_client_id'],
    },
}
