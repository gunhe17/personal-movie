from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends

from app.core.permissions import Permission
from app.modules.billing.payment.handlers.create_payment import create_payment_handler
from app.modules.billing.payment.handlers.list_payments import list_payments_handler
from app.modules.billing.payment.schemas import (
    PaymentCreate,
    PaymentResponse,
    PaymentListResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}/billables/{billable_id}/payments",
    tags=["Billing - Payment"],
)


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=201,
)
async def create_payment(
    billable_id: str,
    data: PaymentCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_BILLING),
            dispatch_events(),
        )
    ),
):
    return await create_payment_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        billable_id=billable_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=PaymentListResponse,
)
async def list_payments(
    billable_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_BILLING),
        )
    ),
):
    return await list_payments_handler(ctx.center_id, billable_id, ctx.uow)
