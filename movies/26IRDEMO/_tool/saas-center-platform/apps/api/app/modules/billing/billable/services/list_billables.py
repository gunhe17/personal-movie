from app.infrastructure.persistence.new_repository import Page
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.billable_item.repository import BillableItemRepository


class ListBillablesService:
    def __init__(
        self,
        billable_repo: BillableRepository,
        item_repo: BillableItemRepository,
    ):
        self.billable_repo = billable_repo
        self.item_repo = item_repo

    async def execute(
        self,
        center_id: str,
        *,
        status: str | None = None,
        client_id: str | None = None,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> tuple[list[tuple[Billable, list[BillableItem]]], dict[str, list[tuple[str, str]]], Page, int]:
        rows, page_meta = await self.billable_repo.list_in_center_with_page(
            center_id=center_id,
            status=status,
            client_id=client_id,
            page=page,
            size=size,
            sort=sort,
        )

        unpaid_total = await self.billable_repo.aggregate_unpaid_total_in_center(
            center_id=center_id,
            status=status,
            client_id=client_id,
        )

        rows_with_items: list[tuple[Billable, list[BillableItem]]] = []
        case_refs_by_billable: dict[str, list[tuple[str, str]]] = {}
        for billable in rows:
            items = await self.item_repo.list_by_billable(billable_id=billable.id)
            rows_with_items.append((billable, items))

            # case refs 수집 (중복 제거, 순서 보존)
            seen: set[tuple[str, str]] = set()
            refs: list[tuple[str, str]] = []
            for item in items:
                related_type = item.related_type or ""
                case_id = item.related_case_id
                if not case_id or not related_type:
                    continue
                # _session 또는 _case 모두 케이스로 환원
                domain_type = (
                    "counseling" if related_type.startswith("counseling") else "assessment"
                )
                key = (domain_type, case_id)
                if key in seen:
                    continue
                seen.add(key)
                refs.append(key)
            case_refs_by_billable[billable.id] = refs

        return rows_with_items, case_refs_by_billable, page_meta, unpaid_total
