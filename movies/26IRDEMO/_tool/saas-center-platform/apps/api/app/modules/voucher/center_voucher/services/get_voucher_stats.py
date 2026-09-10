from datetime import date

from app.modules.voucher.center_voucher.repository import CenterVoucherRepository


class GetVoucherStatsService:
    def __init__(self, repo: CenterVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        expiring_window_days: int = 60,
    ) -> dict:
        return await self.repo.get_voucher_stats(
            center_id=center_id,
            today=date.today(),
            expiring_window_days=expiring_window_days,
        )
