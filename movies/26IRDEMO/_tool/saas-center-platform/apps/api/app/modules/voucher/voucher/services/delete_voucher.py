from ..repository import VoucherRepository


class DeleteVoucherService:
    def __init__(self, repo: VoucherRepository):
        self.repo = repo

    async def execute(self, voucher_id: str) -> str:
        # 삭제 후 audit log용 name 반환.
        voucher = await self.repo.get_by_id(id=voucher_id)

        name = voucher.name
        await self.repo.remove_by_id(id=voucher_id)
        return name
