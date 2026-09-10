from app.core.exceptions import (
    ConflictException,
    InvalidOperationException,
)
from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote


class LinkTaskService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
        *,
        task_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # load
        field_note = await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # verify
        if field_note.schedule_id:
            raise InvalidOperationException(
                f"이미 회기가 연결되어 있습니다: schedule_id={field_note.schedule_id}"
            )

        if field_note.task_id:
            raise InvalidOperationException(
                f"이미 검사가 연결되어 있습니다: task_id={field_note.task_id}"
            )

        existing = await self.repo.find_by_task_in_center(
            task_id=task_id,
            center_id=center_id,
        )
        if existing:
            raise ConflictException(
                f"해당 검사에 이미 필드노트가 존재합니다: task_id={task_id}"
            )

        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            task_id=task_id,
        )

        # return
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={"task_id": task_id},
        )
