from app.core.exceptions import InvalidOperationException
from ..events import FieldNoteAtomic
from ..repository import FieldNoteRepository
from ..models import FieldNote, FieldNoteSummaryStatus


class PrepareSummaryService:
    def __init__(
        self,
        repo: FieldNoteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        center_id: str,
    ) -> tuple[FieldNoteAtomic, FieldNote]:
        # load
        field_note = await self.repo.get_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
        )

        # verify
        if field_note.status != "completed":
            raise InvalidOperationException(
                "녹음이 완료된 필드노트만 요약을 생성할 수 있습니다."
            )

        # mutate
        field_note = await self.repo.update_in_center(
            field_note_id=field_note_id,
            center_id=center_id,
            summary_status=FieldNoteSummaryStatus.GENERATING,
        )

        # return
        return FieldNoteAtomic.updated(
            field_note=field_note,
            changed={"summary_status": FieldNoteSummaryStatus.GENERATING},
        )
