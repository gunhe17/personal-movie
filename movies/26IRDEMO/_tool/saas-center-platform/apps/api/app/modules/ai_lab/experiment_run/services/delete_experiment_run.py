from ..repository import LabExperimentRunRepository


class DeleteExperimentRunService:
    def __init__(self, repo: LabExperimentRunRepository):
        self.repo = repo

    async def execute(self, experiment_id: str) -> None:
        # return
        await self.repo.remove_by_id(id=experiment_id)
