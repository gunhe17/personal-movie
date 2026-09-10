from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ClientFavorite


@dataclass(frozen=True, kw_only=True)
class ClientFavoriteAtomic:
    _act: str
    favorite: ClientFavorite

    @classmethod
    def added(
        cls,
        *,
        favorite: ClientFavorite,
    ) -> tuple["ClientFavoriteAtomic", ClientFavorite]:
        return cls(_act="added", favorite=favorite), favorite

    @classmethod
    def removed(
        cls,
        *,
        favorite: ClientFavorite,
    ) -> tuple["ClientFavoriteAtomic", ClientFavorite]:
        return cls(_act="removed", favorite=favorite), favorite

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "client_favorite"

    def act_entity_id(self) -> uuid_str:
        return self.favorite.id

    def payload(self) -> dict:
        return {
            "data": {
                "person_id": self.favorite.person_id,
                "client_id": self.favorite.client_id,
            }
        }
