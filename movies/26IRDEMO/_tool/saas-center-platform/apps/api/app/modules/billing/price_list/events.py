from dataclasses import dataclass

from app.core.type import uuid_str

from .models import PriceList
from .schemas import PriceListResponse


@dataclass(frozen=True, kw_only=True)
class PriceListAtomic:
    _act: str
    price_list: PriceList
    _changed: dict | None = None

    @classmethod
    def created(cls, *, price_list: PriceList) -> tuple["PriceListAtomic", PriceList]:
        return cls(_act="created", price_list=price_list), price_list

    @classmethod
    def updated(cls, *, price_list: PriceList, changed: dict) -> tuple["PriceListAtomic", PriceList]:
        return cls(_act="updated", price_list=price_list, _changed=changed), price_list

    @classmethod
    def deleted(cls, *, price_list: PriceList) -> tuple["PriceListAtomic", PriceList]:
        return cls(_act="deleted", price_list=price_list), price_list

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "price_list"

    def act_entity_id(self) -> uuid_str:
        return self.price_list.id

    def payload(self) -> dict:
        dump = PriceListResponse.model_validate(self.price_list).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
