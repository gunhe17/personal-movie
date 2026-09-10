from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CenterVoucher
from .schemas import CenterVoucherResponse


@dataclass(frozen=True, kw_only=True)
class CenterVoucherAtomic:
    _act: str
    center_voucher: CenterVoucher
    _changed: dict | None = None

    @classmethod
    def created(cls, *, center_voucher: CenterVoucher) -> tuple["CenterVoucherAtomic", CenterVoucher]:
        return cls(_act="created", center_voucher=center_voucher), center_voucher

    @classmethod
    def updated(cls, *, center_voucher: CenterVoucher, changed: dict) -> tuple["CenterVoucherAtomic", CenterVoucher]:
        return cls(_act="updated", center_voucher=center_voucher, _changed=changed), center_voucher

    @classmethod
    def deleted(cls, *, center_voucher: CenterVoucher) -> tuple["CenterVoucherAtomic", CenterVoucher]:
        return cls(_act="deleted", center_voucher=center_voucher), center_voucher

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center_voucher"

    def act_entity_id(self) -> uuid_str:
        return self.center_voucher.id

    def payload(self) -> dict:
        dump = CenterVoucherResponse.model_validate(self.center_voucher).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
