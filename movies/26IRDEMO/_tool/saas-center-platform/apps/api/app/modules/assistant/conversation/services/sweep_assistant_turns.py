from app.core.type import utc_dt

from ..repository import AssistantTurnRepository


class SweepAssistantTurnsService:
    def __init__(
        self,
        repo: AssistantTurnRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        cutoff: utc_dt,
    ) -> int:
        # return (프로세스 즉사 잔재 running → abandoned)
        return await self.repo.update_stale_running_to_abandoned_all_centers(
            cutoff=cutoff,
        )
