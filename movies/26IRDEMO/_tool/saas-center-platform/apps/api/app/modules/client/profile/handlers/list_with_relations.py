from ..schemas import ClientRole, ClientStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import ClientWithRelationsListResponse
from ...facade.profile_facade import ProfileFacade


async def list_with_relations_handler(
    center_id: str,
    skip: int,
    limit: int,
    role: str | None,
    status: str | None,
    uow: UnitOfWork,
) -> ClientWithRelationsListResponse:
    facade = ProfileFacade(uow)
    result = await facade.list_with_relations_response(
        center_id, skip, limit, role, status
    )
    return result


TOOL = {
    "name": "list_with_relations_handler",
    "permission": "read:client",
    "purpose": "내담자 목록을 가족 관계 정보와 함께 조회한다.",
    "keywords": ["내담자 목록", "고객 목록", "관계 포함 목록", "client 리스트"],
    "boundaries": "내담자 목록(가족 관계 포함, 읽기). 검색은 list_clients_by_filters_handler, 단건은 get_client_handler.",
    "output": "내담자 목록 (ClientWithRelationsListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수.",
            },
            "role": {
                "type": "string",
                "title": "역할 필터",
                "enum": [r.value for r in ClientRole],
                "description": "역할 필터(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "enum": [s.value for s in ClientStatus],
                "description": "상태 필터(선택).",
            },
        },
        "required": [],
    },
}
