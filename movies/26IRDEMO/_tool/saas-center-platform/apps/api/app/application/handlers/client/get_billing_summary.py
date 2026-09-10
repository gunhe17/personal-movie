# client → billing 크로스 모듈이라 여기서 billing facade를 조율한다.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.client.profile.schemas import BillingSummaryResponse


async def get_billing_summary_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
) -> BillingSummaryResponse:
    facade = BillableFacade(uow)
    summary = await facade.get_client_unpaid_summary(
        center_id=center_id, client_id=client_id
    )

    return BillingSummaryResponse(
        unpaid_count=summary.unpaid_count,
        unpaid_amount=summary.unpaid_amount,
        oldest_issued_at=summary.oldest_issued_at,
    )


TOOL = {
    "name": "get_billing_summary_handler",
    "permission": "read:billing",
    "purpose": "한 내담자의 미납 결제 요약(미납 건수·미납 총액·가장 오래된 청구일)을 조회한다.",
    "keywords": [
        "get billing summary",
        "미납",
        "밀린 돈",
        "결제 요약",
        "미수금",
        "안 낸 돈",
        "청구 잔액",
        "결제 현황",
        "수납 요약",
    ],
    "boundaries": (
        "한 내담자의 '돈' 관점 미납 요약만 반환하는 읽기 전용 도구다 — 미납을 포함한 여러 도메인의 "
        "할 일 신호를 한데 모으려면 get_client_signals_handler, 회기·검사 활동량 지표는 "
        "get_client_metrics_handler를 쓴다."
    ),
    "output": "미납 결제 요약 (BillingSummaryResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "미납 요약을 볼 내담자의 UUID.",
            },
        },
        "required": ["client_id"],
    },
}
