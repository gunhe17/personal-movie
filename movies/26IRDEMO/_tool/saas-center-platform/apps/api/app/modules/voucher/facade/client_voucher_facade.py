
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.voucher_form_template.repository import (
    VoucherFormTemplateRepository,
)
from app.modules.voucher.voucher_form_template.services.list_voucher_form_templates import (
    ListVoucherFormTemplatesService,
)
from app.modules.voucher.client_voucher.events import ClientVoucherAtomic
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.client_voucher.schemas import (
    CatalogSummary,
    CenterVoucherSummary,
    ClientVoucherCreate,
    ClientVoucherListResponse,
    ClientVoucherResponse,
    ClientVoucherUpdate,
)
from app.modules.voucher.center_voucher.services.find_center_voucher import (
    FindCenterVoucherService,
)
from app.modules.voucher.center_voucher.services.verify_center_voucher_scope import (
    VerifyCenterVoucherScopeService,
)
from app.modules.voucher.client_voucher.services.create_client_voucher import (
    CreateClientVoucherService,
)
from app.modules.voucher.client_voucher.services.delete_client_voucher import (
    DeleteClientVoucherService,
)
from app.modules.voucher.client_voucher.services.get_client_voucher import (
    GetClientVoucherService,
)
from app.modules.voucher.client_voucher.services.verify_client_voucher import (
    VerifyClientVoucherService,
)
from app.modules.voucher.client_voucher.services.list_client_vouchers import (
    ListClientVouchersService,
)
from app.modules.voucher.client_voucher.services.list_all_client_vouchers import (
    ListAllClientVouchersService,
)
from app.modules.voucher.client_voucher.services.update_client_voucher import (
    UpdateClientVoucherService,
)
from app.modules.voucher.voucher.repository import VoucherRepository
from app.modules.voucher.voucher.services import FindVoucherService

DEFAULT_FIELDS = [
    "id", "client_id", "center_voucher_id",
    "total_sessions", "remaining_sessions",
    "total_amount", "remaining_amount",
    "valid_from", "valid_until",
]


class ClientVoucherFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> ClientVoucherRepository:
        return self._uow.repo(ClientVoucherRepository)

    def _center_voucher_repo(self) -> CenterVoucherRepository:
        return self._uow.repo(CenterVoucherRepository)

    def _catalog_repo(self) -> VoucherRepository:
        return self._uow.repo(VoucherRepository)

    async def _form_template_ids(self, catalog_id: str) -> list[str]:
        links = await ListVoucherFormTemplatesService(
            self._uow.repo(VoucherFormTemplateRepository)
        ).execute(catalog_id)
        return [link.form_template_id for link in links]

    async def to_response(self, record: ClientVoucher) -> ClientVoucherResponse:
        resp = ClientVoucherResponse.model_validate(record)
        cv = await FindCenterVoucherService(self._center_voucher_repo()).execute(
            center_voucher_id=record.center_voucher_id,
        )
        if cv:
            resp.center_voucher = CenterVoucherSummary.model_validate(cv)
            catalog = await FindVoucherService(self._catalog_repo()).execute(
                voucher_id=cv.catalog_id,
            )
            if catalog:
                resp.catalog = CatalogSummary.model_validate(catalog)
                resp.catalog.form_template_ids = await self._form_template_ids(
                    catalog.id
                )
        return resp

    async def _attach_summaries(
        self,
        rows: list[ClientVoucher],
    ) -> list[ClientVoucherResponse]:
        find_center_voucher = FindCenterVoucherService(self._center_voucher_repo())
        find_catalog = FindVoucherService(self._catalog_repo())

        cv_ids = list({r.center_voucher_id for r in rows})
        center_vouchers = {}
        catalog_ids: set[str] = set()
        for cid in cv_ids:
            cv = await find_center_voucher.execute(center_voucher_id=cid)
            if cv:
                center_vouchers[cid] = cv
                catalog_ids.add(cv.catalog_id)

        catalogs = {}
        for cat_id in catalog_ids:
            cat = await find_catalog.execute(voucher_id=cat_id)
            if cat:
                summary = CatalogSummary.model_validate(cat)
                summary.form_template_ids = await self._form_template_ids(cat_id)
                catalogs[cat_id] = summary

        result = []
        for r in rows:
            resp = ClientVoucherResponse.model_validate(r)
            cv = center_vouchers.get(r.center_voucher_id)
            if cv:
                resp.center_voucher = CenterVoucherSummary.model_validate(cv)
                resp.catalog = catalogs.get(cv.catalog_id)
            result.append(resp)
        return result

    async def create_client_voucher(
        self,
        *,
        center_id: str,
        data: ClientVoucherCreate,
        account_id: str,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        cv = await VerifyCenterVoucherScopeService(self._center_voucher_repo()).execute(
            center_id=center_id,
            center_voucher_id=data.center_voucher_id,
        )
        catalog = await FindVoucherService(self._catalog_repo()).execute(
            voucher_id=cv.catalog_id,
        )

        service = CreateClientVoucherService(self._repo())
        return await service.execute(
            center_id=center_id,
            client_id=data.client_id,
            center_voucher_id=data.center_voucher_id,
            center_voucher_is_active=cv.is_active,
            catalog_usage_end_date=catalog.usage_end_date if catalog else None,
            total_sessions=data.total_sessions,
            remaining_sessions=data.remaining_sessions,
            total_amount=data.total_amount,
            remaining_amount=data.remaining_amount,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            created_by=account_id,
        )

    async def list_client_vouchers_with_response(
        self,
        *,
        center_id: str,
        client_id: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> ClientVoucherListResponse:
        service = ListClientVouchersService(self._repo())
        rows, total = await service.execute(
            center_id=center_id,
            client_id=client_id,
            page=page,
            size=size,
        )
        items = await self._attach_summaries(rows)
        return ClientVoucherListResponse.build(items, total, page, size)

    async def list_all_client_vouchers_with_response(
        self,
        *,
        center_id: str,
        cap: int = 3000,
    ) -> list[ClientVoucherResponse]:
        service = ListAllClientVouchersService(self._repo())
        rows = await service.execute(center_id=center_id, cap=cap)
        return await self._attach_summaries(rows)

    async def get_client_voucher_with_response(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> ClientVoucherResponse:
        service = GetClientVoucherService(self._repo())
        record = await service.execute(
            client_voucher_id=client_voucher_id,
            center_id=center_id,
        )
        return await self.to_response(record)

    async def update_client_voucher(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
        data: ClientVoucherUpdate,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        service = UpdateClientVoucherService(self._repo())
        return await service.execute(
            client_voucher_id=client_voucher_id,
            center_id=center_id,
            changed=data.model_dump(mode="json", exclude_unset=True),
            **data.model_dump(exclude_unset=True),
        )

    async def delete_client_voucher(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> tuple[ClientVoucherAtomic, ClientVoucher]:
        service = DeleteClientVoucherService(self._repo())
        return await service.execute(
            client_voucher_id=client_voucher_id,
            center_id=center_id,
        )

    async def verify_client_voucher(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> None:
        service = VerifyClientVoucherService(self._repo())
        await service.execute(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
        )

