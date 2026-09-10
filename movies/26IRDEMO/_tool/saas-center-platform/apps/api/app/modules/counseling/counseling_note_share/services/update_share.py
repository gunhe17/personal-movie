from ..events import CounselingNoteShareAtomic
from ..models import CounselingNoteShare
from ..repository import CounselingNoteShareRepository


class UpdateShareService:
    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        share_id: str,
        center_id: str,
        content: dict,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        updated = await self.repo.update_in_center(
            share_id,
            center_id,
            content=content,
            is_edited=True,
        )
        return CounselingNoteShareAtomic.updated(share=updated, changed={"content": content})
