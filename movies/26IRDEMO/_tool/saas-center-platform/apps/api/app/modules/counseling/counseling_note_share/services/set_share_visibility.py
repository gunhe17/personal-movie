from app.core.datetime_utils import utc_now
from ..events import CounselingNoteShareAtomic
from ..models import CounselingNoteShare, NoteShareStatus
from ..repository import CounselingNoteShareRepository


class SetShareVisibilityService:
    """발행/회수 — 내담자 앱 노출을 여는 유일한 스위치(G3 명시 가시성 플래그)."""

    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        share_id: str,
        center_id: str,
        published: bool,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        status = NoteShareStatus.PUBLISHED if published else NoteShareStatus.DRAFT
        updated = await self.repo.update_in_center(
            share_id,
            center_id,
            status=status,
            published_at=utc_now() if published else None,
        )
        return CounselingNoteShareAtomic.updated(
            share=updated,
            changed={"status": status.value},
        )
