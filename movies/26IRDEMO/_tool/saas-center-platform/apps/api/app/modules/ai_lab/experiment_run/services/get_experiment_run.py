from app.core.exceptions import EntityNotFoundException

from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository


class GetExperimentRunService:
    def __init__(self, repo: LabExperimentRunRepository):
        self.repo = repo

    async def execute(self, experiment_id: str) -> LabExperimentRun:
        # load
        run = await self.repo.find_by_id(id=experiment_id)
        if not run:
            raise EntityNotFoundException(f"실험을 찾을 수 없습니다: {experiment_id}")
        return run
