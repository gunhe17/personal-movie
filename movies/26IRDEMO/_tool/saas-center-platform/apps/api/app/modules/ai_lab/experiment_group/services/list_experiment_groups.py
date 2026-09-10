from app.infrastructure.persistence.new_repository import Page

from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class ListExperimentGroupsService:
    def __init__(
        self,
        repo: LabExperimentGroupRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        **kwargs,
    ) -> tuple[list[LabExperimentGroup], Page]:
        # return
        return await self.repo.list_with_page(**kwargs)
