from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.subscription.repository import (
    AdminSubscriptionRepository,
)
from app.modules.platform_admin.subscription.services.list_failed_subscription_payments import (
    ListFailedSubscriptionPaymentsService,
)
from app.modules.subscription.subscription.schemas import (
    FailedPaymentListResponse,
    FailedPaymentSummary,
)


async def admin_list_failed_payments_handler(
    *,
    page: int = 1,
    size: int = 20,
    uow: UnitOfWork,
) -> FailedPaymentListResponse:
    rows, page_meta = await ListFailedSubscriptionPaymentsService(
        uow.repo(AdminSubscriptionRepository)
    ).execute(
        page=page,
        size=size,
    )

    return FailedPaymentListResponse(
        items=[FailedPaymentSummary(**row) for row in rows],
        total=page_meta["total"],
        page=page,
        size=size,
        pages=page_meta["pages"],
    )


TOOL = {
    "name": "admin_list_failed_payments_handler",
    "permission": None,
    "purpose": "실패한 결제 목록을 조회한다.",
    "keywords": ["실패 결제 목록", "결제 오류 조회", "failed payments"],
    "boundaries": "운영자 전용 — 실패 결제 목록(읽기). 센터별 결제는 admin_list_payments_handler.",
    "output": "실패 결제 목록 (FailedPaymentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
