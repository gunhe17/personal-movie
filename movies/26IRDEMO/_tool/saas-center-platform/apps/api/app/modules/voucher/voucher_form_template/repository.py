from app.core.type import typecheck, uuid_str
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import VoucherFormTemplate


class VoucherFormTemplateRepository(PostgresRepository[VoucherFormTemplate]):
    model = VoucherFormTemplate

    # #
    # command

    @typecheck
    async def add(
        self,
        voucher_id: uuid_str,
        form_template_id: uuid_str,
        kind: str = "기타",
    ) -> VoucherFormTemplate:
        return await super().add(
            VoucherFormTemplate(
                voucher_id=voucher_id,
                form_template_id=form_template_id,
                kind=kind,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_voucher(self, voucher_id: uuid_str) -> list[VoucherFormTemplate]:
        return await self._filter(
            where=[VoucherFormTemplate.voucher_id == voucher_id],
            order_by="created_at",
        )

    @typecheck
    async def find_pair(
        self,
        voucher_id: uuid_str,
        form_template_id: uuid_str,
    ) -> VoucherFormTemplate | None:
        rows = await self._filter(
            where=[
                VoucherFormTemplate.voucher_id == voucher_id,
                VoucherFormTemplate.form_template_id == form_template_id,
            ],
        )
        return rows[0] if rows else None
