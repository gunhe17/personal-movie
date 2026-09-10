from ..repository import CenterNotePreferenceRepository
from ..models import CenterNotePreference


class FindNotePreferenceService:
    def __init__(self, repo: CenterNotePreferenceRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> CenterNotePreference | None:
        # return (부재 = 기본 환경설정 — 직렬화는 handler)
        return await self.repo.find_in_center(center_id=center_id)
