from datetime import date

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.agent_query import merge_fields, normalize_limit, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.center_voucher.models import CenterVoucher
from app.modules.voucher.center_voucher.schemas import (
    CatalogSummary,
    CenterVoucherCreate,
    CenterVoucherDocumentLink,
    CenterVoucherListResponse,
    CenterVoucherResponse,
    CenterVoucherStatsPerItem,
    CenterVoucherStatsResponse,
    CenterVoucherUpdate,
    VoucherCatalogItem,
    VoucherCatalogListResponse,
)
from app.modules.voucher.center_voucher.services.create_center_voucher import (
    CreateCenterVoucherService,
)
from app.modules.voucher.center_voucher.services.delete_center_voucher import (
    DeleteCenterVoucherService,
)
from app.modules.voucher.center_voucher.services.get_center_voucher import (
    GetCenterVoucherService,
)
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.center_voucher.services.verify_center_voucher_scope import (
    VerifyCenterVoucherScopeService,
)
from app.modules.voucher.center_voucher.services.get_voucher_clients import (
    GetVoucherClientsService,
)
from app.modules.voucher.center_voucher.services.get_voucher_document_file import (
    GetVoucherDocumentFileService,
)
from app.modules.voucher.center_voucher.services.get_voucher_documents import (
    GetVoucherDocumentsService,
)
from app.modules.voucher.center_voucher.services.get_voucher_stats import (
    GetVoucherStatsService,
)
from app.modules.voucher.voucher_document.repository import VoucherDocumentRepository
from app.modules.voucher.center_voucher.services.find_center_voucher import (
    FindCenterVoucherService,
)
from app.modules.voucher.center_voucher.services.list_center_vouchers import (
    ListCenterVouchersService,
)
from app.modules.voucher.center_voucher.services.list_center_vouchers_by_agent_filters import (
    ListCenterVouchersByAgentFiltersService,
)
from app.modules.voucher.voucher_form_template.repository import (
    VoucherFormTemplateRepository,
)
from app.modules.voucher.voucher_form_template.services.list_voucher_form_templates import (
    ListVoucherFormTemplatesService,
)
from app.modules.voucher.center_voucher.services.list_voucher_catalog import (
    ListVoucherCatalogService,
)
from app.modules.voucher.center_voucher.services.update_center_voucher import (
    UpdateCenterVoucherService,
)
from app.modules.voucher.center_voucher.events import CenterVoucherAtomic
from app.modules.voucher.voucher.repository import VoucherRepository
from app.modules.voucher.voucher.services import (
    FindVoucherService,
    GetActiveVoucherService,
)

DEFAULT_FIELDS = [
    "id", "catalog_id", "catalog_name",
    "unit_price", "default_total_sessions", "is_active",
]


class CenterVoucherFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> CenterVoucherRepository:
        return self._uow.repo(CenterVoucherRepository)

    def _catalog_repo(self) -> VoucherRepository:
        return self._uow.repo(VoucherRepository)

    async def _form_template_ids(self, catalog_id: str) -> list[str]:
        links = await ListVoucherFormTemplatesService(
            self._uow.repo(VoucherFormTemplateRepository)
        ).execute(catalog_id)
        return [link.form_template_id for link in links]

    async def to_response(self, record: CenterVoucher) -> CenterVoucherResponse:
        resp = CenterVoucherResponse.model_validate(record)
        catalog = await FindVoucherService(self._catalog_repo()).execute(
            voucher_id=record.catalog_id,
        )
        if catalog:
            resp.catalog = CatalogSummary.model_validate(catalog)
            resp.catalog.form_template_ids = await self._form_template_ids(catalog.id)
        return resp

    async def _attach_catalogs(
        self,
        rows: list[CenterVoucher],
    ) -> list[CenterVoucherResponse]:
        find_catalog = FindVoucherService(self._catalog_repo())
        catalog_ids = list({r.catalog_id for r in rows})
        catalogs = {}
        for cid in catalog_ids:
            cat = await find_catalog.execute(voucher_id=cid)
            if cat:
                summary = CatalogSummary.model_validate(cat)
                summary.form_template_ids = await self._form_template_ids(cid)
                catalogs[cid] = summary

        result = []
        for r in rows:
            resp = CenterVoucherResponse.model_validate(r)
            resp.catalog = catalogs.get(r.catalog_id)
            result.append(resp)
        return result

    async def create_center_voucher(
        self,
        *,
        center_id: str,
        data: CenterVoucherCreate,
        account_id: str,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        catalog = await GetActiveVoucherService(self._catalog_repo()).execute(
            voucher_id=data.catalog_id,
        )

        service = CreateCenterVoucherService(self._repo())
        return await service.execute(
            center_id=center_id,
            catalog_id=data.catalog_id,
            catalog_usage_end_date=catalog.usage_end_date,
            unit_price=data.unit_price,
            default_total_sessions=data.default_total_sessions,
            is_active=data.is_active,
            memo=data.memo,
            created_by=account_id,
        )

    async def list_center_vouchers_with_response(
        self,
        *,
        center_id: str,
        is_active: bool | None = None,
        page: int = 1,
        size: int = 50,
    ) -> CenterVoucherListResponse:
        service = ListCenterVouchersService(self._repo())
        rows, total = await service.execute(
            center_id=center_id,
            is_active=is_active,
            page=page,
            size=size,
        )
        items = await self._attach_catalogs(rows)
        return CenterVoucherListResponse.build(items, total, page, size)

    async def get_center_voucher_with_response(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
    ) -> CenterVoucherResponse:
        service = GetCenterVoucherService(self._repo())
        record = await service.execute(
            center_voucher_id=center_voucher_id,
            center_id=center_id,
        )
        return await self.to_response(record)

    async def update_center_voucher(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
        data: CenterVoucherUpdate,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        service = UpdateCenterVoucherService(self._repo())
        return await service.execute(
            center_voucher_id=center_voucher_id,
            center_id=center_id,
            changed=data.model_dump(mode="json", exclude_unset=True),
            **data.model_dump(exclude_unset=True),
        )

    async def delete_center_voucher(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
    ) -> tuple[CenterVoucherAtomic, CenterVoucher]:
        service = DeleteCenterVoucherService(self._repo())
        return await service.execute(
            center_voucher_id=center_voucher_id,
            center_id=center_id,
        )

    async def list_voucher_document_links(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
    ) -> list[CenterVoucherDocumentLink]:
        cv = await VerifyCenterVoucherScopeService(self._repo()).execute(
            center_id=center_id,
            center_voucher_id=center_voucher_id,
        )
        link_repo = self._uow.repo(VoucherDocumentRepository)
        service = GetVoucherDocumentsService(link_repo)
        return await service.execute(catalog_id=cv.catalog_id)

    async def list_voucher_client_rows(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
    ) -> list[ClientVoucher]:
        await VerifyCenterVoucherScopeService(self._repo()).execute(
            center_id=center_id,
            center_voucher_id=center_voucher_id,
        )
        client_voucher_repo = self._uow.repo(ClientVoucherRepository)
        service = GetVoucherClientsService(client_voucher_repo)
        return await service.execute(center_voucher_id=center_voucher_id)

    async def verify_voucher_document_link(
        self,
        *,
        center_id: str,
        center_voucher_id: str,
        global_document_id: str,
    ) -> None:
        cv = await VerifyCenterVoucherScopeService(self._repo()).execute(
            center_id=center_id,
            center_voucher_id=center_voucher_id,
        )
        link_repo = self._uow.repo(VoucherDocumentRepository)
        service = GetVoucherDocumentFileService(link_repo)
        await service.execute(
            catalog_id=cv.catalog_id,
            global_document_id=global_document_id,
        )

    async def get_voucher_stats_with_response(
        self,
        *,
        center_id: str,
        expiring_window_days: int = 60,
    ) -> CenterVoucherStatsResponse:
        service = GetVoucherStatsService(self._repo())
        stats = await service.execute(
            center_id=center_id,
            expiring_window_days=expiring_window_days,
        )
        return CenterVoucherStatsResponse(
            active_count=stats["active_count"],
            total_count=stats["total_count"],
            active_client_voucher_count=stats["active_client_voucher_count"],
            expiring_within_days_count=stats["expiring_within_days_count"],
            expiring_window_days=stats["expiring_window_days"],
            per_voucher=[
                CenterVoucherStatsPerItem(**item) for item in stats["per_voucher"]
            ],
        )

    async def get_center_voucher_summaries_by_ids(
        self,
        ids: list[str],
    ) -> dict[str, str]:
        # 표시 계약 SSOT — center_voucher의 정본 표시 문자열 = 카탈로그(Voucher) name
        if not ids:
            return {}
        find_center_voucher = FindCenterVoucherService(self._repo())
        find_catalog = FindVoucherService(self._catalog_repo())
        catalog_names: dict[str, str | None] = {}
        out: dict[str, str] = {}
        for cvid in dict.fromkeys(ids):
            cv = await find_center_voucher.execute(center_voucher_id=cvid)
            if cv is None:
                continue
            if cv.catalog_id not in catalog_names:
                catalog = await find_catalog.execute(voucher_id=cv.catalog_id)
                catalog_names[cv.catalog_id] = catalog.name if catalog else None
            name = catalog_names[cv.catalog_id]
            if name:
                out[cvid] = name
        return out

    async def query_center_voucher(
        self,
        center_id: str,
        *,
        catalog_id: str | None = None,
        catalog_ids: list[str] | None = None,
        unit_price_min: int | None = None,
        unit_price_max: int | None = None,
        default_total_sessions_min: int | None = None,
        default_total_sessions_max: int | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        date_from: str | date | None = None,
        date_to: str | date | None = None,
        id: str | None = None,
        ids: list[str] | None = None,
        sort: str | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        service = ListCenterVouchersByAgentFiltersService(self._repo())
        rows, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            catalog_id=catalog_id,
            catalog_ids=catalog_ids,
            unit_price_min=unit_price_min,
            unit_price_max=unit_price_max,
            default_total_sessions_min=default_total_sessions_min,
            default_total_sessions_max=default_total_sessions_max,
            is_active=is_active,
            keyword=keyword,
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        # catalog_name = 모듈 내부 해소(카탈로그 Voucher.name) — 크로스모듈 아님
        find_catalog = FindVoucherService(self._catalog_repo())
        catalog_names: dict[str, str | None] = {}
        for cat_id in {r.catalog_id for r in rows}:
            catalog = await find_catalog.execute(voucher_id=cat_id)
            catalog_names[cat_id] = catalog.name if catalog else None

        identity = ["id", "catalog_id"]
        default = DEFAULT_FIELDS
        available = {
            "id", "catalog_id", "catalog_name",
            "unit_price", "default_total_sessions", "is_active", "memo",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(
            rows,
            merged,
            "center_voucher" if namespaced else "",
            resolvers={"catalog_name": lambda e: catalog_names.get(e.catalog_id)},
        ), total

    async def list_voucher_catalog_with_response(
        self,
        *,
        center_id: str,
        q: str | None = None,
        year: int | None = None,
        organization: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> VoucherCatalogListResponse:
        center_rows, _ = await ListCenterVouchersService(self._repo()).execute(
            center_id=center_id,
            is_active=None,
            page=1,
            size=1000,  # 한 센터 취급 사업은 많아야 수십 개
        )
        service = ListVoucherCatalogService(self._catalog_repo())
        items_raw, total = await service.execute(
            active_catalog_ids={r.catalog_id for r in center_rows if r.deleted_at is None},
            q=q,
            year=year,
            organization=organization,
            page=page,
            size=size,
        )
        items = [VoucherCatalogItem.model_validate(i) for i in items_raw]
        return VoucherCatalogListResponse.build(items, total, page, size)
