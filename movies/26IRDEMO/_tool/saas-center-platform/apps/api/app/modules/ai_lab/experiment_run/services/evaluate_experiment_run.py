from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository


class EvaluateExperimentRunService:
    def __init__(self, repo: LabExperimentRunRepository):
        self.repo = repo

    async def execute(
        self,
        experiment_id: str,
        *,
        quality_score: int,
        quality_note: str | None = None,
    ) -> LabExperimentRun | None:
        # load (부재 = None — 호출자 분기)
        exp = await self.repo.find_by_id(id=experiment_id)
        if not exp:
            return None

        # return
        return await self.repo.update_in_place(
            id=experiment_id,
            quality_score=quality_score,
            quality_note=quality_note,
        )
