from ..repository import EventRepository


class ListEventAtomicsService:
    def __init__(self, repo: EventRepository):
        self.repo = repo

    async def execute(self, event_id: str):
        # return
        return await self.repo.load_atomics(event_id=event_id)
