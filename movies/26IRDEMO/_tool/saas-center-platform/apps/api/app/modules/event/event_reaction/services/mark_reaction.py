from ..repository import EventReactionRepository


class MarkReactionService:
    def __init__(self, repo: EventReactionRepository):
        self.repo = repo

    async def execute(
        self,
        event_id: str,
        *,
        reaction: str,
        ok: bool,
        error: str | None = None,
    ) -> None:
        # return
        await self.repo.mark(event_id=event_id, reaction=reaction, ok=ok, error=error)
