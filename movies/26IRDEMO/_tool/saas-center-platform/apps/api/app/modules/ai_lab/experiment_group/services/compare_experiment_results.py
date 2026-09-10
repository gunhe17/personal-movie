def _run_info(run) -> dict:
    return {
        "id": run.id,
        "model_name": run.model_name,
        "quality_score": run.quality_score,
        "estimated_cost_usd": run.estimated_cost_usd,
        "latency_ms": run.latency_ms,
    }


class CompareExperimentResultsService:
    # pure-logic — repo 없음, sync, 입력은 로드된 group/runs(service.md §5)
    def execute(
        self,
        group,
        completed_runs: list,
    ) -> dict:
        summary = {
            "best_quality": None,
            "lowest_cost": None,
            "fastest": None,
        }

        if not completed_runs:
            return summary

        if group.best_run_id:
            best = next((r for r in completed_runs if r.id == group.best_run_id), None)
            if best:
                summary["best_quality"] = _run_info(best)

        if group.cheapest_run_id:
            cheapest = next((r for r in completed_runs if r.id == group.cheapest_run_id), None)
            if cheapest:
                summary["lowest_cost"] = _run_info(cheapest)

        if group.fastest_run_id:
            fastest = next((r for r in completed_runs if r.id == group.fastest_run_id), None)
            if fastest:
                summary["fastest"] = _run_info(fastest)

        return summary
