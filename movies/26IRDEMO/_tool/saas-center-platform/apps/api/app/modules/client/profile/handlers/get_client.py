from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import ClientResponse
from ...facade.profile_facade import ProfileFacade


async def get_client_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    viewer_person_id: str | None = None,
) -> ClientResponse:
    # viewer_person_id가 주어지면 is_favorited를 채운다.
    facade = ProfileFacade(uow)
    return await facade.get_with_response(
        center_id, client_id, viewer_person_id=viewer_person_id
    )


TOOL = {
    "name": "get_client_handler",
    "permission": "read:client",
    "purpose": "내담자 한 건의 상세를 조회한다.",
    "keywords": ["내담자 조회", "고객 상세", "client 조회"],
    "boundaries": "단건 내담자 조회(읽기). 목록은 list_with_relations_handler, 검색은 list_clients_by_filters_handler.",
    "output": "내담자 상세 (ClientResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "조회할 내담자의 UUID.",
            },
        },
        "required": ["client_id"],
    },
}
