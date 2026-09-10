from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictException, InvalidOperationException
from app.core.type import uuid_str

from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote


class CreateFieldNoteService:
    def __init__(self, repo: FieldNoteRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: uuid_str,
        *,
        author_id: uuid_str,
        schedule_id: uuid_str | None = None,
        task_id: uuid_str | None = None,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # verify
        if schedule_id and task_id:
            raise InvalidOperationException(
                "schedule_id와 task_id는 동시에 연결할 수 없습니다 (회기 또는 검사 중 하나)."
            )

        if schedule_id:
            existing = await self.repo.find_by_schedule_in_center(
                schedule_id=schedule_id,
                center_id=center_id,
            )
            if existing:
                raise ConflictException(f"이미 필드노트가 존재합니다: schedule_id={schedule_id}")

        if task_id:
            existing = await self.repo.find_by_task_in_center(
                task_id=task_id,
                center_id=center_id,
            )
            if existing:
                raise ConflictException(f"이미 필드노트가 존재합니다: task_id={task_id}")

        # return
        last_error: IntegrityError | None = None
        for _ in range(5):
            next_number = await self.repo.next_note_number(
                center_id=center_id,
                author_id=author_id,
            ) + 1
            try:
                async with self.repo._session.begin_nested():
                    field_note = await self.repo.add(
                        center_id=center_id,
                        author_id=author_id,
                        schedule_id=schedule_id,
                        task_id=task_id,
                        note_number=next_number,
                    )
                    return FieldNoteAtomic.created(field_note=field_note)
            except IntegrityError as exc:
                last_error = exc
                continue
        raise last_error  # type: ignore[misc]
