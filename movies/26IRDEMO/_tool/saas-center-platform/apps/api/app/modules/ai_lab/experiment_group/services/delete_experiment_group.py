from ..events import ExperimentGroupAtomic
from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class DeleteExperimentGroupService:
    def __init__(
        self,
        repo: LabExperimentGroupRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        group_id: str,
    ) -> tuple[ExperimentGroupAtomic | None, LabExperimentGroup | None]:
        # mutate (부재 시 기존 no-op 계약 유지 — atomic 없음, emit이 None을 걸러 미발행)
        removed = await self.repo.remove_by_id(id=group_id)
        if removed is None:
            return None, None

        # return
        return ExperimentGroupAtomic.deleted(group=removed)
