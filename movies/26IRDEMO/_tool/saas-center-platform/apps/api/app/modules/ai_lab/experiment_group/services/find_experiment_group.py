from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class FindExperimentGroupService:
    def __init__(
        self,
        repo: LabExperimentGroupRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        group_id: str,
    ) -> LabExperimentGroup | None:
        # return
        return await self.repo.find_by_id(id=group_id)
