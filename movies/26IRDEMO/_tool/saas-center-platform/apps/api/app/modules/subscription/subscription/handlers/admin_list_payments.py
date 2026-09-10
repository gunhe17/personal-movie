from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import PaymentListResponse


async def admin_list_payments_handler(
    center_id: str,
    *,
    page: int = 1,
    size: int = 20,
    uow: UnitOfWork,
) -> PaymentListResponse:
    facade = SubscriptionFacade(uow)
    result = await facade.list_payments_paginated_with_response(
        center_id,
        page=page,
        size=size,
    )
    return result


TOOL = {
    "name": "admin_list_payments_handler",
    "permission": None,
    "purpose": "센터의 구독 결제 목록을 조회한다.",
    "keywords": ["결제 목록", "구독 결제 내역", "admin payments"],
    "boundaries": "운영자 전용 — 한 센터의 결제 목록(읽기). 실패 결제는 admin_list_failed_payments_handler.",
    "output": "결제 내역 목록 (PaymentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "결제 내역을 조회할 센터의 UUID.",
            },
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
        "required": ["center_id"],
    },
}
