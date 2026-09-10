from ..models import LabExperimentRun
from ..repository import LabExperimentRunRepository


class ListExperimentRunsByGroupService:
    def __init__(
        self,
        repo: LabExperimentRunRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        group_id: str,
        *,
        status: str | None = None,
    ) -> list[LabExperimentRun]:
        # return
        return await self.repo.list_by_group(group_id=group_id, status=status)
