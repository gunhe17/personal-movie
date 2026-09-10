from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Subscription
from ..subscription_history.schemas import PlanTransition


@dataclass(frozen=True, kw_only=True)
class SubscriptionAtomic:
    # subscription 상태전이 사실. service가 PlanTransition과 atomic을 함께 생성해
    # (atomic, sub, transition)으로 반환 — facade는 pass-through + history 기록(eventing §4).
    _act: str
    subscription: Subscription
    _transition: PlanTransition | None = None

    @classmethod
    def of(
        cls,
        *,
        act: str,
        subscription: Subscription,
        transition: PlanTransition | None = None,
    ) -> tuple["SubscriptionAtomic", Subscription]:
        return cls(_act=act, subscription=subscription, _transition=transition), subscription

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "subscription"

    def act_entity_id(self) -> uuid_str:
        return self.subscription.id

    def payload(self) -> dict:
        # cross-center 크론(apply_expired_downgrades)은 event.center_id가 없어(다센터 배치)
        # atomic payload에 center_id를 실어 감사 귀속을 보존한다.
        data = {
            "center_id": self.subscription.center_id,
            "plan": self.subscription.plan,
            "status": self.subscription.status,
            "reserved_plan": self.subscription.reserved_plan,
        }
        if self._transition is not None:
            t = self._transition
            data.update({
                "from_plan": t.from_plan,
                "to_plan": t.to_plan,
                "reason": t.reason,
            })
        return {"data": data}
