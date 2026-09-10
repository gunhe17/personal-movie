from datetime import datetime

from app.infrastructure.llm.common.cost import estimate_cost, estimate_stt_cost
from ..repository import LlmCallRepository


class AggregateProductionCostsService:
    def __init__(self, repo: LlmCallRepository) -> None:
        self.repo = repo

    async def execute(
        self,
        source_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict:
        # load
        totals, by_purpose = await self.repo.get_production_cost_summary(
            source_type=source_type,
            date_from=date_from,
            date_to=date_to,
        )

        # aggregate
        total_cost = 0.0
        enriched_by_purpose = []
        for row in by_purpose:
            cost = estimate_cost(row["model"], row["input_tokens"], row["output_tokens"])
            cost += estimate_stt_cost(row["model"], row["audio_seconds"])
            total_cost += cost
            enriched_by_purpose.append({
                **row,
                "estimated_cost_usd": round(cost, 6),
            })

        # return
        return {
            **totals,
            "estimated_cost_usd": round(total_cost, 6),
            "by_purpose": enriched_by_purpose,
        }
