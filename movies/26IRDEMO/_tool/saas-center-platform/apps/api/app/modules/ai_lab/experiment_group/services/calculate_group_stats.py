from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset
from ..events import ExperimentGroupAtomic
from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class CalculateGroupStatsService:
    def __init__(
        self,
        repo: LabExperimentGroupRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        group_id: str,
        completed_runs: list,
        failed_runs_count: int,
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        # load
        group = await self.repo.find_by_id(id=group_id)
        if not group:
            raise EntityNotFoundException(f"Experiment group not found: {group_id}")

        # compute
        completed = len(completed_runs)
        failed = failed_runs_count

        best_run_id = unset
        quality_runs = [r for r in completed_runs if r.quality_score is not None]
        if quality_runs:
            best_run_id = max(quality_runs, key=lambda r: r.quality_score).id

        cheapest_run_id = unset
        total_cost_usd = unset
        cost_runs = [r for r in completed_runs if r.estimated_cost_usd is not None]
        if cost_runs:
            cheapest_run_id = min(cost_runs, key=lambda r: r.estimated_cost_usd).id
            total_cost_usd = sum(
                r.estimated_cost_usd for r in cost_runs if r.estimated_cost_usd
            )

        fastest_run_id = unset
        avg_latency_ms = unset
        latency_runs = [r for r in completed_runs if r.latency_ms is not None]
        if latency_runs:
            fastest_run_id = min(latency_runs, key=lambda r: r.latency_ms).id
            avg_latency_ms = int(
                sum(r.latency_ms for r in latency_runs) / len(latency_runs)
            )

        status = unset
        completed_at = unset
        if completed + failed >= group.total_runs:
            if failed == 0:
                status = "completed"
            elif completed == 0:
                status = "failed"
            else:
                status = "partial_failed"
            completed_at = utc_now()

        # mutate
        updated = await self.repo.update_in_place(
            id=group_id,
            status=status,
            completed_at=completed_at,
            completed_runs=completed,
            failed_runs=failed,
            best_run_id=best_run_id,
            cheapest_run_id=cheapest_run_id,
            fastest_run_id=fastest_run_id,
            total_cost_usd=total_cost_usd,
            avg_latency_ms=avg_latency_ms,
        )
        assert updated is not None

        # return
        changed = {
            k: v
            for k, v in dict(
                status=status,
                completed_at=completed_at.isoformat()
                if completed_at is not unset
                else unset,
                completed_runs=completed,
                failed_runs=failed,
                best_run_id=best_run_id,
                cheapest_run_id=cheapest_run_id,
                fastest_run_id=fastest_run_id,
                total_cost_usd=total_cost_usd,
                avg_latency_ms=avg_latency_ms,
            ).items()
            if v is not unset
        }
        return ExperimentGroupAtomic.updated(group=updated, changed=changed)
