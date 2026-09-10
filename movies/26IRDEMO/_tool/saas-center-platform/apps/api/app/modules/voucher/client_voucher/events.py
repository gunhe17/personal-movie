from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ClientVoucher
from .schemas import ClientVoucherResponse


@dataclass(frozen=True, kw_only=True)
class ClientVoucherAtomic:
    _act: str
    client_voucher: ClientVoucher
    _changed: dict | None = None

    @classmethod
    def created(cls, *, client_voucher: ClientVoucher) -> tuple["ClientVoucherAtomic", ClientVoucher]:
        return cls(_act="created", client_voucher=client_voucher), client_voucher

    @classmethod
    def updated(cls, *, client_voucher: ClientVoucher, changed: dict) -> tuple["ClientVoucherAtomic", ClientVoucher]:
        return cls(_act="updated", client_voucher=client_voucher, _changed=changed), client_voucher

    @classmethod
    def deleted(cls, *, client_voucher: ClientVoucher) -> tuple["ClientVoucherAtomic", ClientVoucher]:
        return cls(_act="deleted", client_voucher=client_voucher), client_voucher

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "client_voucher"

    def act_entity_id(self) -> uuid_str:
        return self.client_voucher.id

    def payload(self) -> dict:
        dump = ClientVoucherResponse.model_validate(self.client_voucher).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
