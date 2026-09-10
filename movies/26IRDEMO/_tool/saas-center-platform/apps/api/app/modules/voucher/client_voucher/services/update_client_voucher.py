from app.core.exceptions import (
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.type import unset
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.client_voucher.events import ClientVoucherAtomic


class UpdateClientVoucherService:
    def __init__(self, repo: ClientVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        client_voucher_id: str,
        center_id: str,
        changed: dict,
        total_sessions: int = unset,
        remaining_sessions: int = unset,
        total_amount: int = unset,
        remaining_amount: int = unset,
        valid_from=unset,
        valid_until=unset,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        # load
        record = await self.repo.get_by_id(id=client_voucher_id)
        if record.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        # compute
        update_data = {
            k: v
            for k, v in {
                "total_sessions": total_sessions,
                "remaining_sessions": remaining_sessions,
                "total_amount": total_amount,
                "remaining_amount": remaining_amount,
                "valid_from": valid_from,
                "valid_until": valid_until,
            }.items()
            if v is not unset
        }

        def merged(field: str):
            return update_data.get(field, getattr(record, field))

        eff_total_sessions = merged("total_sessions")
        eff_remaining_sessions = merged("remaining_sessions")
        eff_total_amount = merged("total_amount")
        eff_remaining_amount = merged("remaining_amount")
        eff_valid_from = merged("valid_from")
        eff_valid_until = merged("valid_until")

        # 무결성 재검증 (수정 후 기준)
        if eff_remaining_sessions > eff_total_sessions:
            raise InvalidOperationException(
                "remaining_sessions는 total_sessions를 초과할 수 없습니다"
            )
        # 금액: total_amount가 있을 때만 remaining_amount 상한 검증.
        # (remaining_amount 음수는 보정 영역이라 허용)
        if (
            eff_total_amount is not None
            and eff_remaining_amount is not None
            and eff_remaining_amount > eff_total_amount
        ):
            raise InvalidOperationException(
                "remaining_amount는 total_amount를 초과할 수 없습니다"
            )
        if (
            eff_valid_from is not None
            and eff_valid_until is not None
            and eff_valid_from > eff_valid_until
        ):
            raise InvalidOperationException(
                "valid_from은 valid_until보다 이후일 수 없습니다"
            )

        # update
        record = await self.repo.update_in_center(
            client_voucher_id=client_voucher_id,
            center_id=center_id,
            **update_data,
        )
        return ClientVoucherAtomic.updated(client_voucher=record, changed=changed)
