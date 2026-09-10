from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..experiment_group.events import ExperimentGroupAtomic
from ..experiment_group.models import LabExperimentGroup
from ..experiment_group.repository import LabExperimentGroupRepository
from ..experiment_group.services.create_experiment_group import (
    CreateExperimentGroupService,
)
from ..experiment_group.services.delete_experiment_group import (
    DeleteExperimentGroupService,
)
from ..experiment_group.services.find_experiment_group import FindExperimentGroupService
from ..experiment_group.services.list_experiment_groups import (
    ListExperimentGroupsService,
)
from ..experiment_group.services.update_group_status import UpdateGroupStatusService
from ..experiment_group.services.calculate_group_stats import CalculateGroupStatsService
from ..experiment_group.services.compare_experiment_results import (
    CompareExperimentResultsService,
)
from ..experiment_run.repository import LabExperimentRunRepository
from ..experiment_run.services.list_experiment_runs_by_group import (
    ListExperimentRunsByGroupService,
)
from ..sample_dataset.repository import LabSampleDatasetRepository
from ..sample_dataset.services.find_sample import FindSampleService


class ExperimentGroupFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_experiment_groups(
        self, **kwargs
    ) -> tuple[list[LabExperimentGroup], Page]:
        return await ListExperimentGroupsService(
            self._uow.repo(LabExperimentGroupRepository)
        ).execute(**kwargs)

    async def find_experiment_group(self, group_id: str) -> LabExperimentGroup | None:
        return await FindExperimentGroupService(
            self._uow.repo(LabExperimentGroupRepository)
        ).execute(group_id)

    async def create_experiment_group(
        self,
        *,
        name: str,
        experiment_type: str,
        sample_id: str,
        variants: list[dict],
        description: str | None = None,
        tags: str | None = None,
        memo: str | None = None,
        author_id: str | None = None,
    ):
        sample = await FindSampleService(
            self._uow.repo(LabSampleDatasetRepository)
        ).execute(sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {sample_id}")

        group_repo = self._uow.repo(LabExperimentGroupRepository)
        svc = CreateExperimentGroupService(group_repo)
        return await svc.execute(
            name=name,
            experiment_type=experiment_type,
            sample_id=sample_id,
            variants=variants,
            description=description,
            tags=tags,
            memo=memo,
            author_id=author_id,
        )

    async def get_experiment_comparison(self, group_id: str) -> tuple:
        group = await FindExperimentGroupService(
            self._uow.repo(LabExperimentGroupRepository)
        ).execute(group_id)
        if not group:
            raise EntityNotFoundException(f"Experiment group not found: {group_id}")

        sample = await FindSampleService(
            self._uow.repo(LabSampleDatasetRepository)
        ).execute(group.sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {group.sample_id}")

        runs = await ListExperimentRunsByGroupService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(group_id)
        completed_runs = [r for r in runs if r.status == "completed"]

        comparison = CompareExperimentResultsService().execute(group, completed_runs)
        return group, sample, runs, comparison

    async def start_group(
        self, group_id: str, started_at
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        group_repo = self._uow.repo(LabExperimentGroupRepository)
        return await UpdateGroupStatusService(group_repo).execute(
            group_id,
            "running",
            started_at=started_at,
        )

    async def fail_group(
        self, group_id: str, completed_at
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        group_repo = self._uow.repo(LabExperimentGroupRepository)
        return await UpdateGroupStatusService(group_repo).execute(
            group_id,
            "failed",
            completed_at=completed_at,
        )

    async def finalize_group_stats(
        self, group_id: str
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        run_service = ListExperimentRunsByGroupService(
            self._uow.repo(LabExperimentRunRepository)
        )
        completed = await run_service.execute(group_id, status="completed")
        failed = await run_service.execute(group_id, status="failed")

        group_repo = self._uow.repo(LabExperimentGroupRepository)
        return await CalculateGroupStatsService(group_repo).execute(
            group_id,
            completed,
            len(failed),
        )

    async def delete_experiment_group(
        self, group_id: str
    ) -> tuple[ExperimentGroupAtomic | None, LabExperimentGroup | None]:
        return await DeleteExperimentGroupService(
            self._uow.repo(LabExperimentGroupRepository)
        ).execute(group_id)
