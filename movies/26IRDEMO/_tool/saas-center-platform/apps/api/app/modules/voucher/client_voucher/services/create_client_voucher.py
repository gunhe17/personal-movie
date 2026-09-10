from datetime import date

from app.core.exceptions import (
    InvalidOperationException,
    PermissionDeniedException,
)
from app.modules.voucher.client_voucher.events import ClientVoucherAtomic
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class CreateClientVoucherService:
    def __init__(
        self,
        repo: ClientVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        center_voucher_id: str,
        center_voucher_is_active: bool,
        catalog_usage_end_date: date | None,
        total_sessions: int,
        remaining_sessions: int | None,
        total_amount: int | None,
        remaining_amount: int | None,
        valid_from: date | None,
        valid_until: date | None,
        created_by: str,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        # verify (center_voucher 스코프는 facade가 선행 검증)
        if not center_voucher_is_active:
            raise PermissionDeniedException("비활성 취급 바우처입니다")

        if (
            catalog_usage_end_date is not None
            and catalog_usage_end_date < date.today()
        ):
            raise InvalidOperationException(
                "이미 종료된 사업의 바우처는 발급할 수 없습니다"
            )

        # return
        record = await self.repo.add(
            center_id=center_id,
            client_id=client_id,
            center_voucher_id=center_voucher_id,
            total_sessions=total_sessions,
            remaining_sessions=remaining_sessions,
            total_amount=total_amount,
            remaining_amount=remaining_amount,
            valid_from=valid_from,
            valid_until=valid_until,
            created_by=created_by,
        )
        return ClientVoucherAtomic.created(client_voucher=record)
