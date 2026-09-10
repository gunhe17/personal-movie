from ..models import CounselingNoteShare
from ..repository import CounselingNoteShareRepository


class GetShareService:
    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        share_id: str,
        center_id: str,
    ) -> CounselingNoteShare:
        return await self.repo.get_in_center(share_id=share_id, center_id=center_id)
