from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.center.center.models import Center
from app.modules.llm.credit_balance.models import CreditBalance


class AdminAiUsageRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def aggregate_top_credit_users(
        self,
        *,
        limit: int = 10,
    ) -> list[dict]:
        stmt = (
            select(
                CreditBalance.center_id,
                func.coalesce(Center.name, "알 수 없음").label("center_name"),
                CreditBalance.plan_type.label("plan"),
                CreditBalance.credit_used,
                CreditBalance.credit_limit,
            )
            .outerjoin(
                Center,
                (Center.id == CreditBalance.center_id) & Center.deleted_at.is_(None),
            )
            .where(
                CreditBalance.deleted_at.is_(None),
                CreditBalance.credit_limit > 0,
            )
            .order_by(CreditBalance.credit_used.desc())
        )
        if limit > 0:
            stmt = stmt.limit(limit)

        result = await self._session.execute(stmt)
        return [row._asdict() for row in result.all()]
