from ..repository import EventReactionRepository


class ListCompletedReactionsService:
    def __init__(self, repo: EventReactionRepository):
        self.repo = repo

    async def execute(self, event_id: str) -> set[str]:
        # return
        return await self.repo.completed(event_id=event_id)
