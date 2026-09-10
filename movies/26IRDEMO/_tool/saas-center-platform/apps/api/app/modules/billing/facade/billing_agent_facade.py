
from app.core.logger import get_logger
from app.infrastructure.persistence.agent_query import merge_fields
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..billable.repository import BillableRepository
from ..billable.services.aggregate_billables import AggregateBillablesService


_NS_BILLABLE = "billable"
_NS_PRICE_LIST = "price_list"
_NS_PAYMENT = "payment"

# 크로스모듈 이름(client_name·created_by_name·reference_name)은 query handler 본문이 인라인
# 조립 — 여기는 자기 모듈 해소(item_names=billable_item)만.
_IDENTITY = {
    _NS_BILLABLE: ["id", "client_id", "status"],
    _NS_PRICE_LIST: ["id", "service_name"],
    _NS_PAYMENT: ["id", "billable_id"],
}

_DEFAULTS = {
    _NS_BILLABLE: [
        "id", "client_id", "status", "item_names",
        "total_amount", "unpaid_amount", "paid_amount",
        "billable_date", "due_date", "issued_at",
    ],
    _NS_PRICE_LIST: ["id", "service_name", "reference_id", "service_type", "unit_price", "is_active"],
    _NS_PAYMENT: [
        "id", "billable_id", "amount",
        "payment_method", "paid_at", "receipt_number",
    ],
}

_AVAILABLE = {
    _NS_BILLABLE: {
        "total_amount", "unpaid_amount", "paid_amount",
        "status", "billable_date", "due_date", "memo",
        "issued_at", "item_names",
        "id", "center_id", "client_id", "created_by",
    },
    _NS_PRICE_LIST: {
        "service_name", "service_type", "unit_price", "is_active",
        "memo", "reference_id", "source",
        "id", "center_id", "created_by",
    },
    _NS_PAYMENT: {
        "amount", "payment_method", "paid_at", "receipt_number", "memo",
        "id", "billable_id",
    },
}


logger = get_logger(__name__)


class BillingAgentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def aggregate_billable(
        self,
        center_id: str,
        **filters,
    ) -> dict:
        repo = self._uow.repo(BillableRepository)
        return await AggregateBillablesService(repo).execute(center_id, **filters)

def _merge_fields(fields: list[str] | None, namespace: str) -> list[str]:
    return merge_fields(
        fields, _DEFAULTS[namespace], _AVAILABLE[namespace], identity=_IDENTITY[namespace],
    )

