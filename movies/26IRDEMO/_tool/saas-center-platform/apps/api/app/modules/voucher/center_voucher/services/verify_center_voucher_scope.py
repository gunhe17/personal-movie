from app.core.exceptions import PermissionDeniedException

from ..models import CenterVoucher
from ..repository import CenterVoucherRepository


class VerifyCenterVoucherScopeService:
    def __init__(
        self,
        repo: CenterVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
    ) -> CenterVoucher:
        # load
        cv = await self.repo.get_by_id(id=center_voucher_id)

        # verify
        if cv.center_id != center_id:
            raise PermissionDeniedException("권한 없음")

        return cv
