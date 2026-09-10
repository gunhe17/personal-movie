from sqlalchemy import func
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import PlanConfig


class PlanConfigRepository(PostgresRepository[PlanConfig]):
    model = PlanConfig

    # #
    # command

    @typecheck
    async def update_by_plan_type(
        self,
        plan_type: str,
        *,
        label: str = unset,
        price_monthly: int = unset,
        credit_limit: int = unset,
        features: str = unset,
        plan_order: int = unset,
        is_active: bool = unset,
        tagline: str | None = unset,
        audience: str | None = unset,
        is_recommended: bool = unset,
        base_features: str | None = unset,
        additions: str | None = unset,
        base_plan: str | None = unset,
        badge_bg: str | None = unset,
        badge_text: str | None = unset,
        feature_labels: str | None = unset,
        feature_descriptions: str | None = unset,
    ) -> PlanConfig | None:
        fields = {
            "label": label,
            "price_monthly": price_monthly,
            "credit_limit": credit_limit,
            "features": features,
            "plan_order": plan_order,
            "is_active": is_active,
            "tagline": tagline,
            "audience": audience,
            "is_recommended": is_recommended,
            "base_features": base_features,
            "additions": additions,
            "base_plan": base_plan,
            "badge_bg": badge_bg,
            "badge_text": badge_text,
            "feature_labels": feature_labels,
            "feature_descriptions": feature_descriptions,
        }
        data = {k: v for k, v in fields.items() if v is not unset}
        stmt = (
            sql_update(self.model)
            .where(self.model.plan_type == plan_type, self.model.deleted_at.is_(None))
            .values(**data, updated_at=func.now())
            .returning(self.model)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    # #
    # query

    @typecheck
    async def list_active(self) -> list[PlanConfig]:
        return await self._filter(order_by="plan_order")

    @typecheck
    async def find_by_plan_type(self, plan_type: str) -> PlanConfig | None:
        return await self._find_by(column="plan_type", value=plan_type)

    @typecheck
    async def get_by_plan_type(self, plan_type: str) -> PlanConfig:
        row = await self.find_by_plan_type(plan_type=plan_type)
        if row is None:
            raise EntityNotFoundException(f"플랜을 찾을 수 없습니다: {plan_type}")
        return row
