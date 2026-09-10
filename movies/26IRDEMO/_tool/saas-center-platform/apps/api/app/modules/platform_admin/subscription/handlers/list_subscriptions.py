from app.infrastructure.persistence.new_repository import offset_page
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.subscription.repository import (
    AdminSubscriptionRepository,
)
from app.modules.platform_admin.subscription.services.list_subscriptions import (
    ListSubscriptionsService,
)
from app.modules.subscription.subscription.schemas import (
    AdminSubscriptionListResponse,
    AdminSubscriptionSummary,
)


async def list_subscriptions_handler(
    *,
    plan: str | None = None,
    status: str | None = None,
    search: str | None = None,
    has_scheduled_downgrade: bool | None = None,
    page: int = 1,
    size: int = 20,
    uow: UnitOfWork,
) -> AdminSubscriptionListResponse:
    rows, total = await ListSubscriptionsService(
        uow.repo(AdminSubscriptionRepository)
    ).execute(
        plan=plan,
        status=status,
        search=search,
        has_scheduled_downgrade=has_scheduled_downgrade,
        page=page,
        size=size,
    )

    items = [AdminSubscriptionSummary(**row) for row in rows]
    return AdminSubscriptionListResponse(
        items=items,
        **offset_page(total, (page - 1) * size, size),
    )


TOOL = {
    "name": "list_subscriptions_handler",
    "permission": None,
    "purpose": "전체 구독 목록을 요금제·상태·검색으로 거르고 조회한다.",
    "keywords": ["구독 목록", "가입 목록", "subscriptions 리스트"],
    "boundaries": "운영자 전용 — 전체 센터 구독 목록(읽기). 단건은 get_subscription_handler.",
    "output": "구독 목록 (AdminSubscriptionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "plan": {
                "type": "string",
                "title": "요금제 필터",
                "description": "요금제 필터(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "구독 상태 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "센터명 검색어(선택).",
            },
            "has_scheduled_downgrade": {
                "type": "boolean",
                "title": "다운그레이드 예약 필터",
                "description": "다운그레이드 예약이 있는 구독만 필터(선택).",
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
        "required": [],
    },
}
