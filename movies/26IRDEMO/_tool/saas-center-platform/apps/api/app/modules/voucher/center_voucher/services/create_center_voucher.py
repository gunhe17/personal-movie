from datetime import date

from app.core.exceptions import (
    ConflictException,
    InvalidOperationException,
)
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.center_voucher.events import CenterVoucherAtomic


class CreateCenterVoucherService:
    def __init__(
        self,
        repo: CenterVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        catalog_id: str,
        catalog_usage_end_date: date | None,
        unit_price: int | None,
        default_total_sessions: int | None,
        is_active: bool,
        memo: str | None,
        created_by: str,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        # verify
        if (
            catalog_usage_end_date is not None
            and catalog_usage_end_date < date.today()
        ):
            raise InvalidOperationException("이미 종료된 사업은 등록할 수 없습니다")

        existing = await self.repo.find_by_catalog_id(
            center_id=center_id,
            catalog_id=catalog_id,
        )
        if existing:
            raise ConflictException("이미 등록된 사업입니다")

        # return
        record = await self.repo.add(
            center_id=center_id,
            catalog_id=catalog_id,
            unit_price=unit_price,
            default_total_sessions=default_total_sessions,
            is_active=is_active,
            memo=memo,
            created_by=created_by,
        )
        return CenterVoucherAtomic.created(center_voucher=record)
