from datetime import datetime
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset
from ..events import ExperimentGroupAtomic
from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class UpdateGroupStatusService:
    def __init__(
        self,
        repo: LabExperimentGroupRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        group_id: str,
        status: str,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        # load
        group = await self.repo.find_by_id(id=group_id)
        if not group:
            raise EntityNotFoundException(f"Experiment group not found: {group_id}")

        # mutate
        updated = await self.repo.update_in_place(
            id=group_id,
            status=status,
            started_at=started_at if started_at else unset,
            completed_at=completed_at if completed_at else unset,
        )
        assert updated is not None

        # return
        changed: dict = {"status": status}
        if started_at:
            changed["started_at"] = started_at.isoformat()
        if completed_at:
            changed["completed_at"] = completed_at.isoformat()
        return ExperimentGroupAtomic.updated(group=updated, changed=changed)
