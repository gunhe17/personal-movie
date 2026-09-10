from datetime import datetime

from ..repository import LabExperimentRunRepository


class AggregateCostsService:
    def __init__(
        self,
        repo: LabExperimentRunRepository,
    ) -> None:
        self.repo = repo

    async def execute(
        self,
        *,
        production_summary: dict,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict:
        # load
        lab = await self.repo.get_lab_cost_summary(date_from=date_from, date_to=date_to)

        # return
        return {"production": production_summary, "lab": lab}
