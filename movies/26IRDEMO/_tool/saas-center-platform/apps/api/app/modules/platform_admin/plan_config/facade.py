from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import PlanConfigRepository
from .services.update_plan_config import UpdatePlanConfigService


class PlanConfigFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def update_plan_config(
        self,
        plan_type: str,
        **fields,
    ):
        return await UpdatePlanConfigService(
            self._uow.repo(PlanConfigRepository)
        ).execute(plan_type=plan_type, **fields)
