from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import PermissionDeniedException
from app.modules.event import emit
from ..schemas import ClientFavoriteResponse
from ..repository import ClientFavoriteRepository
from ..services import AddFavoriteService
from ...profile.repository import ClientRepository


async def add_favorite_handler(
    person_id: str,
    client_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientFavoriteResponse:
    favorite_repo = uow.repo(ClientFavoriteRepository)
    client_repo = uow.repo(ClientRepository)

    client = await client_repo.get_by_id(client_id)
    if client.center_id != center_id:
        raise PermissionDeniedException("Client가 해당 센터 소속이 아닙니다")

    service = AddFavoriteService(favorite_repo)
    atomic, favorite = await service.execute(person_id, client_id, center_id)
    await emit(
        uow,
        "client_favorite_added",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientFavoriteResponse.model_validate(favorite)


TOOL = {
    "name": "add_favorite_handler",
    "permission": "read:client",
    "purpose": "내담자를 즐겨찾기에 추가한다.",
    "keywords": ["즐겨찾기 추가", "관심 내담자 등록", "북마크", "favorite 추가"],
    "boundaries": "내담자를 '본인' 즐겨찾기에 추가. 해제는 remove_favorite_handler, 목록은 application의 list_favorites_handler.",
    "output": "즐겨찾기 등록 결과 (ClientFavoriteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자",
                          "description": "즐겨찾기할 내담자의 UUID."},
        },
        "required": ["client_id"],
    },
}
