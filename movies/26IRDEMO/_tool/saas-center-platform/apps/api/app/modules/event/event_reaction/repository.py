from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import EventReaction


class EventReactionRepository(PostgresRepository[EventReaction]):
    model = EventReaction

    # #
    # command

    @typecheck
    async def mark(self, *, event_id: uuid_str, reaction: str, ok: bool, error: str | None = None) -> None:
        stmt = (
            pg_insert(EventReaction)
            .values(event_id=event_id, reaction=reaction, ok=ok, error=error)
            .on_conflict_do_update(
                index_elements=["event_id", "reaction"],
                set_={"ok": ok, "error": error, "updated_at": func.now()},
            )
        )
        await self._session.execute(stmt)

    # #
    # query

    @typecheck
    async def completed(self, *, event_id: uuid_str) -> set[str]:
        rows = await self._session.scalars(
            select(EventReaction.reaction).where(
                EventReaction.event_id == event_id, EventReaction.ok.is_(True)
            )
        )
        return set(rows)
