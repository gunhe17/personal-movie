from app.core.exceptions import PermissionDeniedException
from app.core.type import unset
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.center_voucher.events import CenterVoucherAtomic


class UpdateCenterVoucherService:
    def __init__(self, repo: CenterVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_voucher_id: str,
        center_id: str,
        changed: dict,
        unit_price: int = unset,
        default_total_sessions: int = unset,
        is_active: bool = unset,
        memo: str = unset,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        # load
        record = await self.repo.get_by_id(id=center_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # update
        update_data = {
            k: v
            for k, v in {
                "unit_price": unit_price,
                "default_total_sessions": default_total_sessions,
                "is_active": is_active,
                "memo": memo,
            }.items()
            if v is not unset
        }
        record = await self.repo.update_in_center(
            center_voucher_id=center_voucher_id,
            center_id=center_id,
            **update_data,
        )
        return CenterVoucherAtomic.updated(center_voucher=record, changed=changed)
