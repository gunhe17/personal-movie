from app.core.type import uuid_str

from ..models import Voucher
from ..repository import VoucherRepository


class GetVoucherService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
    ) -> Voucher:
        # return (삭제분 포함 — 존재 검증 경로)
        return await self.repo.get_by_id_all_states(id=voucher_id)
