from app.core.type import uuid_str

from ..models import VoucherFormTemplate
from ..repository import VoucherFormTemplateRepository


class LinkVoucherFormTemplateService:
    def __init__(
        self,
        repo: VoucherFormTemplateRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: uuid_str,
        form_template_id: uuid_str,
        *,
        kind: str = "기타",
    ) -> tuple[VoucherFormTemplate, bool]:
        # load — 같은 쌍을 두 번 걸지 않는다(멱등). 삭제된 행은 partial unique 밖이라 걸림돌이 아니다
        existing = await self.repo.find_pair(
            voucher_id=voucher_id,
            form_template_id=form_template_id,
        )
        if existing is not None:
            return existing, False

        # return
        link = await self.repo.add(
            voucher_id=voucher_id,
            form_template_id=form_template_id,
            kind=kind,
        )
        return link, True
