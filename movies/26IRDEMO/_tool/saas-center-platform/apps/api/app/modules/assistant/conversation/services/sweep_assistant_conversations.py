from app.core.type import utc_dt

from ..repository import AssistantConversationRepository


class SweepAssistantConversationsService:
    def __init__(
        self,
        repo: AssistantConversationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        cutoff: utc_dt,
    ) -> int:
        # return (턴 0건 방치 대화 정리)
        return await self.repo.remove_empty_all_centers(
            cutoff=cutoff,
        )
