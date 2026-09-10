from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import LabExperimentGroup


class LabExperimentGroupRepository(PostgresRepository[LabExperimentGroup]):
    model = LabExperimentGroup

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        experiment_type: str,
        sample_id: uuid_str,
        total_runs: int,
        status: str = "pending",
        completed_runs: int = 0,
        failed_runs: int = 0,
        description: str | None = None,
        tags: str | None = None,
        memo: str | None = None,
        author_id: uuid_str | None = None,
    ) -> LabExperimentGroup:
        return await super().add(
            LabExperimentGroup(
                name=name,
                experiment_type=experiment_type,
                sample_id=sample_id,
                total_runs=total_runs,
                status=status,
                completed_runs=completed_runs,
                failed_runs=failed_runs,
                description=description,
                tags=tags,
                memo=memo,
                author_id=author_id,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        started_at: utc_dt | None = unset,
        completed_at: utc_dt | None = unset,
        completed_runs: int = unset,
        failed_runs: int = unset,
        best_run_id: uuid_str | None = unset,
        cheapest_run_id: uuid_str | None = unset,
        fastest_run_id: uuid_str | None = unset,
        total_cost_usd: float | None = unset,
        avg_latency_ms: int | None = unset,
    ) -> LabExperimentGroup | None:
        return await self.update_fields(
            id,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            completed_runs=completed_runs,
            failed_runs=failed_runs,
            best_run_id=best_run_id,
            cheapest_run_id=cheapest_run_id,
            fastest_run_id=fastest_run_id,
            total_cost_usd=total_cost_usd,
            avg_latency_ms=avg_latency_ms,
        )

    # #
    # query

    @typecheck
    async def list_with_page(
        self,
        experiment_type: str | None = None,
        status: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[LabExperimentGroup], Page]:
        where = []
        if experiment_type:
            where.append(LabExperimentGroup.experiment_type == experiment_type)
        if status:
            where.append(LabExperimentGroup.status == status)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )
