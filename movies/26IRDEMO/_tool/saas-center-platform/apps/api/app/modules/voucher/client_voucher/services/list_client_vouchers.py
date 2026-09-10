from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository


class ListClientVouchersService:
    def __init__(self, repo: ClientVoucherRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str | None,
        page: int,
        size: int,
    ) -> tuple[list[ClientVoucher], int]:
        if client_id is not None:
            rows = await self.repo.list_by_client(
                client_id=client_id, center_id=center_id
            )
            total = len(rows)
            # 클라이언트별 조회는 페이지네이션 적용하지 않음 (보유 바우처는 적음)
        else:
            rows, page_meta = await self.repo.list_by_center_with_page(
                center_id=center_id, page=page, size=size
            )
            total = page_meta["total"]

        return rows, total
