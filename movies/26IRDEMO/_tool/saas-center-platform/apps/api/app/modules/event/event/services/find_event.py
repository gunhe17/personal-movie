from ..repository import EventRepository


class FindEventService:
    def __init__(self, repo: EventRepository):
        self.repo = repo

    async def execute(self, event_id: str):
        # return
        return await self.repo.find_by_id(event_id)
