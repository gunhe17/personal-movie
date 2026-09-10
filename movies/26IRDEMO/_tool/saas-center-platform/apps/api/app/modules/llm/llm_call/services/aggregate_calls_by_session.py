from ..repository import LlmCallRepository


class AggregateCallsBySessionService:
    def __init__(self, repo: LlmCallRepository):
        self.repo = repo

    async def execute(self, session_id: str) -> dict:
        # return
        return await self.repo.aggregate_by_session(session_id)
