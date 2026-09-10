from datetime import date
from app.core.datetime_utils import parse_date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade.billing_agent_facade import BillingAgentFacade



async def aggregate_billables_handler(
    center_id: str,
    owner_scope: str | None,  # noqa: ARG001 — read:billing 게이트의 센터 단위 집계
    status: str | None,
    date_from: str | None,
    date_to: str | None,
    uow: UnitOfWork,
) -> dict:
    return await BillingAgentFacade(uow).aggregate_billable(
        center_id,
        status=status,
        date_from=parse_date(date_from, "date_from"),
        date_to=parse_date(date_to, "date_to"),
    )


TOOL = {
    "name": "aggregate_billables_handler",
    "permission": "read:billing",
    "purpose": "센터 전체 청구의 건수·총액·미납 총액을 DB에서 집계한다 (행 나열 아님).",
    "keywords": [
        "aggregate billables",
        "미납 총액",
        "청구 합계",
        "총 얼마",
        "매출",
        "전체 미납",
    ],
    "boundaries": "'총액/합계/몇 건' 질문은 여기 — query_billable_handler(행 나열)로 직접 더하지 말 것. 내담자 1명 요약은 get_billing_summary_handler.",
    "output": "{count, total_amount_sum, unpaid_amount_sum} — DB 집계라 건수 상한 없음.",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "청구 상태",
                "enum": ["issued", "paid"],
                "description": "'발행/미결제'→issued, '결제완료'→paid. 미납 총액은 status 없이 unpaid_amount_sum을 읽는다",
            },
            "date_from": {"type": "string", "format": "date", "title": "청구일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "청구일 종료"},
        },
        "required": [],
    },
}
