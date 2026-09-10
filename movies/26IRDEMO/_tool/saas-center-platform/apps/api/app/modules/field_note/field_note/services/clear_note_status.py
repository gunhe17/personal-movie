from app.core.type import uuid_str

from ..events import FieldNoteAtomic
from ..models import FieldNote, FieldNoteNoteStatus
from ..repository import FieldNoteRepository


class ClearNoteStatusService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: uuid_str,
        center_id: uuid_str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # mutate (생성 실패 복구 — 노트 상태 표식 해제)
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            note_status=FieldNoteNoteStatus.NONE,
        )

        # return
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={"note_status": FieldNoteNoteStatus.NONE},
        )
