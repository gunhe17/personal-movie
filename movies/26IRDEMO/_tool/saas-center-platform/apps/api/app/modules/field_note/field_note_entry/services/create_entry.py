from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str

from ..repository import FieldNoteEntryRepository
from ..models import FieldNoteEntry, FieldNoteEntryType, FieldNoteTagCategory


class CreateEntryService:
    def __init__(
        self,
        repo: FieldNoteEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        *,
        entry_type: FieldNoteEntryType,
        content: str,
        timestamp_seconds: float,
        tag_category: FieldNoteTagCategory | None = None,
    ) -> FieldNoteEntry:
        # verify
        if entry_type == FieldNoteEntryType.TAG and not tag_category:
            raise InvalidOperationException("태그 타입에는 tag_category가 필요합니다")

        # return
        return await self.repo.add(
            field_note_id=field_note_id,
            entry_type=entry_type,
            content=content,
            timestamp_seconds=timestamp_seconds,
            tag_category=tag_category,
        )
