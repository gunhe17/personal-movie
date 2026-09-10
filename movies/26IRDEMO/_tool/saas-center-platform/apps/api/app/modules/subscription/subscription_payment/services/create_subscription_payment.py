import time

from app.core.exceptions import InvalidOperationException
from app.modules.subscription.subscription_payment.events import SubscriptionPaymentAtomic
from app.modules.subscription.subscription_payment.models import SubscriptionPayment
from app.modules.subscription.subscription.plan_config import PlanType, PaymentStatus, get_plan_config, is_upgrade
from app.modules.subscription.subscription_payment.repository import SubscriptionPaymentRepository


class CreateSubscriptionPaymentService:
    def __init__(
        self,
        repo: SubscriptionPaymentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_plan: str,
        *,
        subscription_id: str,
        current_plan: str,
    ) -> tuple[SubscriptionPaymentAtomic, SubscriptionPayment]:
        # verify
        plan_type = PlanType(target_plan)
        if not is_upgrade(current_plan, target_plan):
            raise InvalidOperationException(
                f"{current_plan} → {target_plan}은 업그레이드가 아닙니다. 결제가 필요한 건 업그레이드뿐입니다."
            )

        config = get_plan_config(plan_type)
        if config.price_monthly <= 0:
            raise InvalidOperationException(f"{plan_type.value} 플랜은 결제가 필요 없습니다.")

        order_id = f"sub_{center_id[:8]}_{int(time.time())}"

        # create
        payment = await self.repo.add_in_center(
            center_id=center_id,
            subscription_id=subscription_id,
            plan=target_plan,
            amount=config.price_monthly,
            status=PaymentStatus.PENDING,
            toss_order_id=order_id,
        )

        # return
        return SubscriptionPaymentAtomic.of(act="created", payment=payment)
