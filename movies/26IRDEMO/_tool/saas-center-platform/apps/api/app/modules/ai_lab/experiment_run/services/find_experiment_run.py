from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository


class FindExperimentRunService:
    def __init__(self, repo: LabExperimentRunRepository):
        self.repo = repo

    async def execute(self, experiment_id: str) -> LabExperimentRun | None:
        # return
        return await self.repo.find_by_id(id=experiment_id)
