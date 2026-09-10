from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import ClientFavoriteRepository
from ..services import RemoveFavoriteService


async def remove_favorite_handler(
    person_id: str,
    client_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    center_id: str | None,
    actor_id: str | None,
) -> None:
    favorite_repo = uow.repo(ClientFavoriteRepository)
    service = RemoveFavoriteService(favorite_repo)
    atomic, _favorite = await service.execute(person_id, client_id)
    await emit(
        uow,
        "client_favorite_removed",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "remove_favorite_handler",
    "permission": "read:client",
    "purpose": "내담자 즐겨찾기를 해제한다.",
    "keywords": ["즐겨찾기 해제", "관심 해제", "북마크 제거", "favorite 삭제"],
    "boundaries": "'본인' 즐겨찾기에서 내담자 제거. 추가는 add_favorite_handler.",
    "output": "없음 (해제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자",
                          "description": "즐겨찾기 해제할 내담자의 UUID."},
        },
        "required": ["client_id"],
    },
}
