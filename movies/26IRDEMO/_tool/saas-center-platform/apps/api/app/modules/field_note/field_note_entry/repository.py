from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import FieldNoteEntry, FieldNoteEntryType, FieldNoteTagCategory


class FieldNoteEntryRepository(PostgresRepository[FieldNoteEntry]):
    model = FieldNoteEntry

    # #
    # command

    @typecheck
    async def add(
        self,
        field_note_id: uuid_str,
        entry_type: FieldNoteEntryType,
        content: str,
        timestamp_seconds: float,
        tag_category: FieldNoteTagCategory | None = None,
    ) -> FieldNoteEntry:
        return await super().add(
            FieldNoteEntry(
                field_note_id=field_note_id,
                entry_type=entry_type,
                content=content,
                timestamp_seconds=timestamp_seconds,
                tag_category=tag_category,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_field_note(
        self,
        field_note_id: uuid_str,
    ) -> list[FieldNoteEntry]:
        return await self._filter(
            where=[FieldNoteEntry.field_note_id == field_note_id],
            order_by="timestamp_seconds",
        )
