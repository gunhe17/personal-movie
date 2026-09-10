from dataclasses import dataclass

from app.core.type import utc_dt


@dataclass(frozen=True)
class PlanTransition:
    subscription_id: str
    to_plan: str
    actor_type: str
    reason: str
    changed_at: utc_dt
    from_plan: str | None = None
    from_status: str | None = None
    to_status: str | None = None
