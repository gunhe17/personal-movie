from dataclasses import dataclass
from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.billable.events import BillableAtomic
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.billable_item.repository import BillableItemRepository
from app.modules.billing.billable.schemas import (
    BillableCreate,
    BillableCreateResult,
    BillableUpdate,
    BillableResponse,
    BillableItemResponse,
    BillableListResponse,
    BillableSummary,
    fill_summary_from_items,
)
from app.modules.billing.billable.services.aggregate_unpaid_summary import AggregateUnpaidSummaryService
from app.modules.billing.billable.services.count_unpaid_by_case_ids import CountUnpaidByCaseIdsService
from app.modules.billing.billable.services.create_billable import CreateBillableService
from app.modules.billing.billable.services.list_billables import ListBillablesService
from app.modules.billing.billable.services.list_billables_by_ids import ListBillablesByIdsService
from app.modules.billing.billable.services.get_billable import GetBillableService
from app.modules.billing.billable.services.complete_billable import CompleteBillableService
from app.modules.billing.billable.services.update_billable import UpdateBillableService
from app.modules.billing.billable.services.list_by_related import ListBillablesByRelatedService
from app.modules.billing.billable_item.services import (
    AggregateCoverageRowsService,
    AggregateUsageByVoucherMonthlyService,
    ListBilledCaseIdsService,
    ListBilledSessionIdsService,
    ListUsageByVoucherService,
    MapSessionToClientVoucherService,
)


@dataclass(frozen=True)
class ClientUnpaidSummary:
    unpaid_count: int
    unpaid_amount: int
    oldest_issued_at: datetime | None


class BillableFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _billable_repo(self) -> BillableRepository:
        return self._uow.repo(BillableRepository)

    def _item_repo(self) -> BillableItemRepository:
        return self._uow.repo(BillableItemRepository)

    async def get_client_unpaid_summary(
        self,
        center_id: str,
        client_id: str,
    ) -> ClientUnpaidSummary:
        count, amount, oldest = await AggregateUnpaidSummaryService(self._billable_repo()).execute(
            center_id=center_id, client_id=client_id
        )
        return ClientUnpaidSummary(
            unpaid_count=count,
            unpaid_amount=amount,
            oldest_issued_at=oldest,
        )

    async def get_billable_summaries_by_ids(
        self,
        billable_ids: list[str],
    ) -> dict[str, str]:
        # 청구서 정본 표시 = 청구일 · 총액 (자기 표시문자열, 이름 컬럼 없음 — agent-query.md summary 투영)
        if not billable_ids:
            return {}
        billables = await ListBillablesByIdsService(self._billable_repo()).execute(billable_ids)
        return {
            b.id: f"{b.billable_date:%Y-%m-%d} · {b.total_amount:,}원"
            for b in billables
        }

    async def create_billable(
        self,
        *,
        center_id: str,
        data: BillableCreate,
        account_id: str,
    ) -> tuple[BillableAtomic, BillableCreateResult]:
        service = CreateBillableService(
            self._billable_repo(),
            self._item_repo(),
        )
        item_rows = [item.model_dump() for item in data.items]
        return await service.execute(
            center_id=center_id,
            client_id=data.client_id,
            billable_date=data.billable_date,
            due_date=data.due_date,
            memo=data.memo,
            discount_amount=data.discount_amount,
            subsidy_amount=data.subsidy_amount,
            item_rows=item_rows,
            account_id=account_id,
        )

    async def count_unpaid_by_case_ids(
        self,
        center_id: str,
        case_ids: list[str],
    ) -> int:
        return await CountUnpaidByCaseIdsService(self._billable_repo()).execute(
            center_id=center_id,
            case_ids=case_ids,
        )

    async def list_billables_with_response(
        self,
        *,
        center_id: str,
        status: str | None = None,
        client_id: str | None = None,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> tuple[BillableListResponse, dict[str, list[tuple[str, str]]]]:
        service = ListBillablesService(self._billable_repo(), self._item_repo())
        rows, case_refs, meta, unpaid_total = await service.execute(
            center_id,
            status=status,
            client_id=client_id,
            page=page,
            size=size,
            sort=sort,
        )
        summaries = [
            fill_summary_from_items(BillableSummary.model_validate(b), items)
            for b, items in rows
        ]
        return (
            BillableListResponse.build(
                summaries, meta["total"], page, size, unpaid_total=unpaid_total
            ),
            case_refs,
        )

    async def get_billable_with_response(
        self,
        *,
        center_id: str,
        billable_id: str,
    ) -> BillableResponse:
        service = GetBillableService(self._billable_repo(), self._item_repo())
        billable, items = await service.execute(billable_id=billable_id, center_id=center_id)
        response = BillableResponse.model_validate(billable)
        response.items = [BillableItemResponse.model_validate(i) for i in items]
        return response

    async def update_billable(
        self,
        *,
        center_id: str,
        billable_id: str,
        data: BillableUpdate,
    ) -> tuple[BillableAtomic, Billable, list[BillableItem]]:
        # omit/null 판정은 HTTP 경계 한 곳 — set된 필드만 관통, non-nullable 명시 null은 드롭(유지)
        fields = {k: getattr(data, k) for k in data.model_fields_set}
        for key in ("billable_date", "discount_amount"):
            if key in fields and fields[key] is None:
                del fields[key]

        service = UpdateBillableService(self._billable_repo(), self._item_repo())
        atomic, _ = await service.execute(
            billable_id=billable_id,
            center_id=center_id,
            changed=data.model_dump(mode="json", exclude_unset=True),
            **fields,
        )
        billable, items = await GetBillableService(
            self._billable_repo(), self._item_repo()
        ).execute(billable_id=billable_id, center_id=center_id)
        return atomic, billable, items

    async def complete_billable(
        self,
        *,
        center_id: str,
        billable_id: str,
    ) -> tuple[BillableAtomic, Billable, list[BillableItem]]:
        service = CompleteBillableService(self._billable_repo())
        atomic, _ = await service.execute(
            billable_id=billable_id,
            center_id=center_id,
        )

        billable, items = await GetBillableService(
            self._billable_repo(), self._item_repo()
        ).execute(billable_id=billable_id, center_id=center_id)
        return atomic, billable, items

    async def list_billed_session_ids(
        self,
        *,
        center_id: str,
        client_id: str,
        related_type: str,
    ) -> set[str]:
        return await ListBilledSessionIdsService(self._item_repo()).execute(
            center_id=center_id,
            client_id=client_id,
            related_type=related_type,
        )

    async def map_session_to_client_voucher(
        self,
        *,
        session_ids: list[str],
    ) -> dict[str, str]:
        return await MapSessionToClientVoucherService(self._item_repo()).execute(
            session_ids=session_ids,
        )

    async def list_billed_case_ids(
        self,
        *,
        center_id: str,
        client_id: str,
        related_type: str,
    ) -> set[str]:
        return await ListBilledCaseIdsService(self._item_repo()).execute(
            center_id=center_id,
            client_id=client_id,
            related_type=related_type,
        )

    async def get_billing_coverage(
        self,
        *,
        center_id: str,
        counseling_session_ids: set[str],
        assessment_session_ids: set[str],
        counseling_case_ids: set[str],
        assessment_case_ids: set[str],
    ) -> dict:
        rows = await AggregateCoverageRowsService(self._item_repo()).execute(
            center_id=center_id,
            counseling_session_ids=counseling_session_ids,
            assessment_session_ids=assessment_session_ids,
            counseling_case_ids=counseling_case_ids,
            assessment_case_ids=assessment_case_ids,
        )
        session_client_pairs: set[tuple[str, str]] = set()
        case_ids_counseling: set[str] = set()
        case_ids_assessment: set[str] = set()
        for related_type, case_id, session_id, client_id in rows:
            if related_type in ("counseling_session", "assessment_session") and session_id and client_id:
                session_client_pairs.add((session_id, client_id))
            elif related_type == "counseling_case" and case_id:
                case_ids_counseling.add(case_id)
            elif related_type == "assessment_case" and case_id:
                case_ids_assessment.add(case_id)
        return {
            "session_client_pairs": session_client_pairs,
            "case_ids_counseling": case_ids_counseling,
            "case_ids_assessment": case_ids_assessment,
        }

    async def list_usage_by_voucher(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> list[tuple]:
        return await ListUsageByVoucherService(self._item_repo()).execute(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
        )

    async def aggregate_usage_by_voucher_monthly(
        self,
        *,
        center_id: str,
        client_voucher_id: str,
    ) -> list[tuple[str, int, int, int, int]]:
        return await AggregateUsageByVoucherMonthlyService(self._item_repo()).execute(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
        )

    async def list_by_related_with_response(
        self,
        *,
        center_id: str,
        related_type: str | list[str],
        related_case_id: str | None = None,
        related_session_id: str | None = None,
    ) -> list[BillableSummary]:
        service = ListBillablesByRelatedService(
            self._billable_repo(), self._item_repo()
        )
        rows = await service.execute(
            center_id,
            related_type,
            related_case_id=related_case_id,
            related_session_id=related_session_id,
        )
        return [
            fill_summary_from_items(BillableSummary.model_validate(b), items)
            for b, items in rows
        ]
